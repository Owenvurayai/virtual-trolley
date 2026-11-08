import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Product, SimulationSnapshot, StatusResponse } from './models';

/** Thin wrapper over the REST API. No state, no logic: just typed HTTP calls. */
@Injectable({ providedIn: 'root' })
export class SimulationApiService {
  private readonly http = inject(HttpClient);

  // Relative URLs: the dev-server proxy (proxy.conf.json) forwards /api to Spring Boot.
  private readonly base = '/api/simulation';

  start(): Observable<StatusResponse> {
    return this.http.post<StatusResponse>(`${this.base}/start`, null);
  }

  pause(): Observable<StatusResponse> {
    return this.http.post<StatusResponse>(`${this.base}/pause`, null);
  }

  resume(): Observable<StatusResponse> {
    return this.http.post<StatusResponse>(`${this.base}/resume`, null);
  }

  reset(): Observable<StatusResponse> {
    return this.http.post<StatusResponse>(`${this.base}/reset`, null);
  }

  state(): Observable<SimulationSnapshot> {
    return this.http.get<SimulationSnapshot>(`${this.base}/state`);
  }

  products(): Observable<Product[]> {
    return this.http.get<Product[]>('/api/products');
  }
}
