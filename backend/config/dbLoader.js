const mongoose = require('mongoose');
const localDb = require('./localDb');

const schemas = {};

const modelProxy = (modelName, schema) => {
  schemas[modelName] = schema;

  // Register with localDb
  localDb.registerModel(modelName, schema);

  const dummyConstructor = function() {};
  return new Proxy(dummyConstructor, {
    get(target, prop, receiver) {
      const isLocal = !!global.useLocalJsonDb;
      
      if (isLocal) {
        const model = localDb.getModel(modelName);
        const val = model[prop];
        if (typeof val === 'function') {
          return val.bind(model);
        }
        return val;
      } else {
        let mongooseModel;
        try {
          mongooseModel = mongoose.model(modelName);
        } catch (e) {
          mongooseModel = mongoose.model(modelName, schema);
        }
        const val = mongooseModel[prop];
        if (typeof val === 'function') {
          return val.bind(mongooseModel);
        }
        return val;
      }
    },
    construct(target, args, newTarget) {
      const isLocal = !!global.useLocalJsonDb;
      if (isLocal) {
        const ModelClass = localDb.getModel(modelName);
        return new ModelClass(...args);
      } else {
        let mongooseModel;
        try {
          mongooseModel = mongoose.model(modelName);
        } catch (e) {
          mongooseModel = mongoose.model(modelName, schema);
        }
        return new mongooseModel(...args);
      }
    }
  });
};

module.exports = {
  Schema: mongoose.Schema,
  model: modelProxy,
  connect: mongoose.connect.bind(mongoose),
  connection: mongoose.connection,
};
