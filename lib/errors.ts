/** Erreur "métier" : son message est affiché tel quel à l'utilisateur. */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Erreur de configuration serveur (variable d'environnement manquante, etc.). */
export class ConfigError extends Error {}
