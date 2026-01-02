declare module "@azure/functions" {
  export interface HttpRequest {
    method: string;
    url: string;
    headers: Record<string, string | undefined>;
    query: Record<string, any>;
    params?: Record<string, any>;
    body?: any;
  }

  export interface HttpResponse {
    status?: number;
    headers?: Record<string, string>;
    body?: any;
    jsonBody?: any;
  }

  export interface Context {
    log: any;
    bindingData: Record<string, any>;
    req?: HttpRequest;
    res?: HttpResponse;
  }

  export type AzureFunction = (context: Context, req: HttpRequest) => void | Promise<void>;
}
