const addSerialNoComman = async (data) => {
    let serialNo = 1;
    return data.map((item) => {
        return {
            ...item,
            serial_no: serialNo++,
        };
    });
};

module.exports = addSerialNoComman;