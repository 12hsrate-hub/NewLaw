export class DocumentServerUnavailableError extends Error {
  constructor() {
    super("Документы этого сервера сейчас недоступны. Код: DOCUMENT_SERVER_UNAVAILABLE.");
    this.name = "DocumentServerUnavailableError";
  }
}

export class DocumentCharacterUnavailableError extends Error {
  constructor() {
    super("На этом сервере нельзя создать документ без доступного персонажа.");
    this.name = "DocumentCharacterUnavailableError";
  }
}

export class DocumentAccessDeniedError extends Error {
  constructor() {
    super("Документ не найден или недоступен текущему аккаунту.");
    this.name = "DocumentAccessDeniedError";
  }
}

export class DocumentRepresentativeAccessError extends Error {
  constructor() {
    super("Representative filing доступен только персонажу с access flag advocate.");
    this.name = "DocumentRepresentativeAccessError";
  }
}

export class DocumentAttorneyRoleRequiredError extends Error {
  constructor() {
    super("Создать адвокатский запрос может только персонаж с ролью адвоката.");
    this.name = "DocumentAttorneyRoleRequiredError";
  }
}

export class DocumentValidationError extends Error {
  constructor() {
    super("Документ не прошёл валидацию.");
    this.name = "DocumentValidationError";
  }
}
