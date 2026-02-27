import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { Logger } from "../core/Logger";
import { getJanNetApiBaseUrl } from "../core/ApiConfig";
import type { FeaturedServersResponse, FeaturedServer } from "../../shared/types";

// Actual API response structure from JanNet
interface JanNetApiServer {
  id: string;
  name: string;
  short_description: string;
  address: string;
  port: number;
  region: string;
  languages: string[];
  banner_url: string | null;
  website_url: string | null;
}

interface JanNetFeaturedServersResponse {
  main: JanNetApiServer[];
  page: JanNetApiServer[];
}

export class JanNetApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = getJanNetApiBaseUrl();
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        "User-Agent": "JanLauncher",
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        const method = config.method?.toUpperCase() || "GET";
        const url = config.url || "";
        Logger.debug("JanNetApiClient", `[JANNET] Request: ${method} ${url}`);
        return config;
      },
      (error) => {
        Logger.error("JanNetApiClient", "[JANNET] Request error", error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        const method = response.config.method?.toUpperCase() || "GET";
        const url = response.config.url || "";
        const status = response.status;
        Logger.debug("JanNetApiClient", `[JANNET] Response: ${method} ${url} - ${status}`);
        return response;
      },
      (error) => {
        if (error.response) {
          const status = error.response.status;
          const method = error.config?.method?.toUpperCase() || "GET";
          const url = error.config?.url || "";
          Logger.error(
            "JanNetApiClient",
            `[JANNET] Response error: ${method} ${url} - ${status}`,
            error.response.data
          );
        } else if (error.request) {
          Logger.error("JanNetApiClient", "[JANNET] No response received", error.message);
        } else {
          Logger.error("JanNetApiClient", "[JANNET] Request setup error", error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  setTimeout(timeout: number): void {
    this.client.defaults.timeout = timeout;
  }

  setAuthToken(token: string | null): void {
    if (token) {
      this.client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      Logger.debug("JanNetApiClient", "[JANNET] Auth token set");
    } else {
      delete this.client.defaults.headers.common["Authorization"];
      Logger.debug("JanNetApiClient", "[JANNET] Auth token removed");
    }
  }

  setHeader(key: string, value: string): void {
    this.client.defaults.headers.common[key] = value;
  }

  removeHeader(key: string): void {
    delete this.client.defaults.headers.common[key];
  }

  async getFeaturedServers(): Promise<FeaturedServersResponse> {
    const response = await this.get<JanNetFeaturedServersResponse>("/launcher/featured");
    const apiData = response.data;
    
    // Handle null or invalid data
    if (!apiData || typeof apiData !== 'object') {
      return { servers: [] };
    }
    
    // Transform API response to expected format
    const servers: FeaturedServer[] = [];
    
    // Add servers from "main" array with type "main"
    if (apiData.main && Array.isArray(apiData.main)) {
      for (const server of apiData.main) {
        servers.push({
          name: server.name,
          description: server.short_description,
          ip: server.address,
          port: server.port,
          type: "main",
          advertiseUrl: server.website_url || undefined
        });
      }
    }
    
    // Add servers from "page" array with type "page"
    if (apiData.page && Array.isArray(apiData.page)) {
      for (const server of apiData.page) {
        servers.push({
          name: server.name,
          description: server.short_description,
          ip: server.address,
          port: server.port,
          type: "page",
          advertiseUrl: server.website_url || undefined
        });
      }
    }
    
    return { servers };
  }

}

let apiClientInstance: JanNetApiClient | null = null;

export function getJanNetApiClient(): JanNetApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new JanNetApiClient();
  }
  return apiClientInstance;
}
