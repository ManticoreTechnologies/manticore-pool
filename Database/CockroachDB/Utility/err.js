const err_map = {
    'no database or schema specified': 'Database %[0] does not exist. Unable to create %[1]',
    'user root does not have CREATE privilege on database system': 'User %[2] is not allowed to create table %[1] in database %[0]'
}

const cockroach_error = (err, args) => {
    try {
        let errorMessage = err_map[err.message];
        for (let i = 0; i < args.length; i++) {
            errorMessage = errorMessage.replace(`%[${i}]`, `'${args[i]}'`);
        }
        return errorMessage || err.message;
    } catch (error) {
        return err.message;
    }
}

module.exports = cockroach_error;