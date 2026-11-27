/** Error controlado de la aplicación, con código HTTP y detalle opcional. */
class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
module.exports = AppError;
