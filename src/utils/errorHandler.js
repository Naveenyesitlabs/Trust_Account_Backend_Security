const handleError = (err, res) => {
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: 'Internal server error' });
};

module.exports = handleError;
