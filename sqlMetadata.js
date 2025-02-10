const { createNamespace, getNamespace } = require('@ehsc/cls-hooked');

exports.wrapSequelize = (sequelize) => {
    if (sequelize.__alreadyMetadataWrapped__) {
        return;
    }
    const { run } = sequelize.dialect.Query.prototype;
    // eslint-disable-next-line func-names
    sequelize.dialect.Query.prototype.run = function (sql, sql_options) {
        if (sequelize.__middleware__) {
            const session = getNamespace('sql-metadata');
            const req = session?.get('req');
            if (req) {
                if (req.__sql_metadata__) {
                    req.__sql_metadata__.push({ sql, sql_options });
                } else {
                    req.__sql_metadata__ = [{ sql, sql_options }];
                }
            }
        }
        return run.apply(this, [sql, sql_options]);
    };
    sequelize.__alreadyMetadataWrapped__ = true;
};

exports.responseSendAttachSqlMetadta = (req, res, next) => {
    const { send } = res;
    res.send = function (body) {
        if (req && req.__sql_metadata__ && body && typeof body === 'object') {
            send.apply(res, [{ ...body, __sql_metadata__: req.__sql_metadata__ }]);
        } else send.apply(res, [body]);
    };
    next();
};

exports.wrapSqlMetadata = (sequelize) => {
    exports.wrapSequelize(sequelize);
    return (req, res, next) => {
        const session = createNamespace('sql-metadata');
        session.run(() => {
            session.set('req', req);
            session.set('res', res);
            sequelize.__middleware__ = true;
            next();
        });
    };
};
