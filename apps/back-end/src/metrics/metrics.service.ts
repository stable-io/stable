import { Injectable } from "@nestjs/common";
import type { LabelValues } from "prom-client";
import { Counter, Gauge, Histogram, Registry, Summary } from "prom-client";

type LV = LabelValues<string>;

@Injectable()
export class MetricsService {
  private readonly externalRegistries: Registry[] = [];
  private readonly registry = new Registry();
  private readonly counters = new Map<string, Counter>();
  private readonly gauges = new Map<string, Gauge>();
  private readonly histograms = new Map<string, Histogram>();
  private readonly summaries = new Map<string, Summary>();

  private getCounter(id: string, labels: string[]): Counter {
    const counter = this.counters.get(id);
    if (counter) {
      return counter;
    }
    const newCounter = new Counter({
      name: id,
      help: id,
      registers: [this.registry],
      labelNames: labels,
    });
    this.counters.set(id, newCounter);
    return newCounter;
  }

  public counter(id: string, labels: LV, value: number): void {
    const counter = this.getCounter(id, Object.keys(labels));
    counter.inc(labels, value);
  }

  private getGauge(id: string, labels: string[]): Gauge {
    const gauge = this.gauges.get(id);
    if (gauge) {
      return gauge;
    }
    const newGauge = new Gauge({
      name: id,
      help: id,
      registers: [this.registry],
      labelNames: labels,
    });
    this.gauges.set(id, newGauge);
    return newGauge;
  }

  public gauge(id: string, labels: LV, value: number): void {
    const gauge = this.getGauge(id, Object.keys(labels));
    if (value > 0) {
      gauge.inc(value)
    }
    if (value < 0) {
      gauge.dec(1)
    }
  }

  private getHistogram(id: string, labels: string[]): Histogram {
    const histogram = this.histograms.get(id);
    if (histogram) {
      return histogram;
    }
    const newHistogram = new Histogram({
      name: id,
      help: id,
      registers: [this.registry],
      labelNames: labels,
    });
    this.histograms.set(id, newHistogram);
    return newHistogram;
  }

  public histogram(id: string, labels: LV, value: number): void {
    const histogram = this.getHistogram(id, Object.keys(labels));
    histogram.observe(labels, value);
  }

  private getSummary(id: string, labels: string[]): Summary {
    const summary = this.summaries.get(id);
    if (summary) {
      return summary;
    }
    const newSummary = new Summary({
      name: id,
      help: id,
      registers: [this.registry],
      labelNames: labels,
    });
    this.summaries.set(id, newSummary);
    return newSummary;
  }

  public summary(id: string, labels: LV, value: number): void {
    const summary = this.getSummary(id, Object.keys(labels));
    summary.observe(labels, value);
  }

  public addRegistry(registry: Registry): void {
    this.externalRegistries.push(registry);
  }

  public async getReport(): Promise<string> {
    const totalMetrics = Registry.merge([
      this.registry,
      ...this.externalRegistries,
    ]);
    return totalMetrics.metrics();
  }
}
