import { context, metrics, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import {
  defaultResource,
  resourceFromAttributes,
} from "@opentelemetry/resources";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  BasicTracerProvider,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

// Standard OTel env vars (read automatically by the SDK):
//   OTEL_EXPORTER_OTLP_ENDPOINT     — HTTP collector (default: http://localhost:4318)
//   OTEL_EXPORTER_OTLP_HEADERS      — auth headers (key=value,key2=value2)
//   OTEL_SERVICE_NAME               — service name
//   OTEL_RESOURCE_ATTRIBUTES        — e.g. deployment.environment=production
//   OTEL_TRACES_SAMPLER / _ARG      — sampling (default: parentbased_always_on)
//
// Custom env vars (read manually below):
//   GIT_HASH                        — mapped to service.version
//   OTEL_METRIC_EXPORT_INTERVAL     — metric flush interval in ms (default 60000)
//                                     (PeriodicExportingMetricReader doesn't read this automatically)

export interface OtelSDK {
  tracerProvider: BasicTracerProvider;
  meterProvider: MeterProvider;
  shutdown: () => Promise<void>;
}

export function setupOtel(): OtelSDK {
  // defaultResource() already reads OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES.
  // Merge GIT_HASH → service.version only when the env var is present.
  const resource = process.env.GIT_HASH
    ? defaultResource().merge(
        resourceFromAttributes({
          [ATTR_SERVICE_VERSION]: process.env.GIT_HASH,
        }),
      )
    : defaultResource();

  // ---------------------------------------------------------------------------
  // Context propagation
  // AsyncLocalStorage is supported by Bun; async_hooks-based context propagation
  // (used by NodeTracerProvider) is not — spans would export as NonRecordingSpan.
  // ---------------------------------------------------------------------------
  const contextManager = new AsyncLocalStorageContextManager();
  contextManager.enable();
  context.setGlobalContextManager(contextManager);

  // ---------------------------------------------------------------------------
  // Traces
  // ---------------------------------------------------------------------------
  const traceExporter = new OTLPTraceExporter();
  const tracerProvider = new BasicTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
  });
  trace.setGlobalTracerProvider(tracerProvider);

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------
  const metricExporter = new OTLPMetricExporter();
  const parsed = parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL ?? "", 10);
  const exportIntervalMillis = Number.isNaN(parsed) ? 60_000 : parsed;

  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis,
      }),
    ],
  });
  metrics.setGlobalMeterProvider(meterProvider);

  // ---------------------------------------------------------------------------
  // Auto-instrumentation
  // UndiciInstrumentation uses diagnostics_channel (no module patching) so it
  // works in Bun — gives automatic spans for all undici/discord.js HTTP calls.
  // ---------------------------------------------------------------------------
  registerInstrumentations({
    instrumentations: [new UndiciInstrumentation()],
    tracerProvider,
    meterProvider,
  });

  const shutdown = async () => {
    await Promise.all([tracerProvider.shutdown(), meterProvider.shutdown()]);
  };

  return { tracerProvider, meterProvider, shutdown };
}
