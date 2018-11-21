let config = require('./env-var-defaults.json');
if (process.env._TS_ENV_FILE) {
    config = Object.assign(config, require(process.env._TS_ENV_FILE));
}
let missing = false;
Object.entries(config).forEach(([key, value]) => {
    if (!process.env[key]) {
        if (value) {
            process.env[key] = value;
        } else {
            console.error("missing env variable " + key);
            missing = true;
        }
    }
});
if (missing) {
    process.exit(21);
}
