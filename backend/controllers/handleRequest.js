async function handleRequest(res, operation) {
  try {
    const result = await operation();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Internal server error",
      ...(error.code ? { code: error.code } : {}),
    });
  }
}

module.exports = handleRequest;
