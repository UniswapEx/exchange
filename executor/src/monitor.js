module.exports = class Monitor {
    constructor(w3) {
        this.w3 = w3;
    }

    async onBlock(callback) {
        var last_block = 0;
        while (true) {
            const new_block = await this.w3.eth.getBlockNumber();
            if (new_block != last_block) {
                await callback(new_block);
                last_block = new_block;
            }
        }
    }
}
