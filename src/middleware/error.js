export function createAppErrorMiddleware() {
  return (error, req, res, next) => {
    const status = error.status || error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Internal Server Error' });
  };
}
