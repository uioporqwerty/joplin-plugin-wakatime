export enum Environment {
  Production,
  Development,
}

export function getEnvironment(): Environment {
  return process.env.NODE_ENV == "production"
    ? Environment.Production
    : Environment.Development;
}
