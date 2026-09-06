const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Memory cache of data
const database = {};

// Simple helper to generate MongoDB-like ObjectIDs
const generateId = () => {
  return Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
};

const loadData = (modelName) => {
  const filepath = path.join(DATA_DIR, `${modelName}.json`);
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify([], null, 2));
    database[modelName] = [];
  } else {
    try {
      database[modelName] = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      if (Array.isArray(database[modelName])) {
        let modified = false;
        database[modelName].forEach(doc => {
          if (!doc._id) {
            doc._id = generateId();
            modified = true;
          }
        });
        if (modified) {
          fs.writeFileSync(filepath, JSON.stringify(database[modelName], null, 2));
        }
      }
    } catch (e) {
      console.error(`Error reading database file for ${modelName}:`, e);
      database[modelName] = [];
    }
  }
  return database[modelName];
};

const saveData = (modelName) => {
  const filepath = path.join(DATA_DIR, `${modelName}.json`);
  fs.writeFileSync(filepath, JSON.stringify(database[modelName] || [], null, 2));
};

// Match document helper
const matchQuery = (doc, query) => {
  if (!query) return true;
  for (let key in query) {
    let queryVal = query[key];
    let docVal = doc[key];

    // Handle Mongoose $in operator
    if (queryVal && typeof queryVal === 'object' && '$in' in queryVal) {
      const allowed = queryVal['$in'];
      if (!Array.isArray(allowed)) continue;
      if (!allowed.includes(docVal)) return false;
      continue;
    }

    // Handle Mongoose $ne operator
    if (queryVal && typeof queryVal === 'object' && '$ne' in queryVal) {
      const notEqualVal = queryVal['$ne'];
      if (docVal && typeof docVal === 'object' && docVal._id) {
        if (String(docVal._id) === String(notEqualVal)) return false;
      } else if (String(docVal) === String(notEqualVal)) {
        return false;
      }
      continue;
    }

    // Standard equality
    if (key === '_id' || key === 'studentId') {
      const qValStr = queryVal ? String(queryVal._id || queryVal) : null;
      const dValStr = docVal ? String(docVal._id || docVal) : null;
      if (qValStr !== dValStr) return false;
    } else {
      if (docVal !== queryVal) return false;
    }
  }
  return true;
};

// Document Class
class LocalDocument {
  constructor(modelName, data) {
    this._modelName = modelName;
    Object.assign(this, data);
    if (!this._id) {
      this._id = generateId();
    }
  }

  async save() {
    const list = loadData(this._modelName);
    
    // Add timestamps
    const now = new Date().toISOString();
    if (!this.createdAt) {
      this.createdAt = now;
    }
    this.updatedAt = now;

    // Convert keys/methods to clean JS object for saving
    const toSave = {};
    for (let key of Object.keys(this)) {
      if (!key.startsWith('_')) {
        toSave[key] = this[key];
      }
    }
    toSave._id = this._id;
    toSave.createdAt = this.createdAt;
    toSave.updatedAt = this.updatedAt;

    const idx = list.findIndex(d => String(d._id) === String(this._id));
    if (idx >= 0) {
      list[idx] = toSave;
    } else {
      list.push(toSave);
    }
    
    saveData(this._modelName);
    Object.assign(this, toSave);
    return this;
  }
}

// Query Chain Class for handling find/findOne results
class LocalQueryChain {
  constructor(modelName, promiseFunc) {
    this._modelName = modelName;
    this._promiseFunc = promiseFunc;
    this._sortRules = null;
    this._selectFields = null;
    this._populatePaths = [];
  }

  sort(sortRules) {
    this._sortRules = sortRules;
    return this;
  }

  select(selectFields) {
    this._selectFields = selectFields;
    return this;
  }

  populate(path) {
    this._populatePaths.push(path);
    return this;
  }

  async exec() {
    let result = await this._promiseFunc();
    
    // Handle Populate
    if (this._populatePaths.length > 0 && result) {
      const listToPopulate = Array.isArray(result) ? result : [result];
      for (let doc of listToPopulate) {
        for (let pPath of this._populatePaths) {
          const refId = doc[pPath];
          if (refId) {
            let refModelName = 'Student'; // Default mapping, we can resolve dynamically
            if (pPath === 'studentId') refModelName = 'Student';
            
            const refList = loadData(refModelName);
            const refDoc = refList.find(d => String(d._id) === String(refId._id || refId));
            if (refDoc) {
              doc[pPath] = refDoc;
            }
          }
        }
      }
    }

    // Handle Sort
    if (this._sortRules && Array.isArray(result)) {
      result.sort((a, b) => {
        for (let key in this._sortRules) {
          let dir = this._sortRules[key];
          let valA = a[key];
          let valB = b[key];
          
          if (valA === undefined) return 1;
          if (valB === undefined) return -1;

          if (typeof valA === 'string') {
            const cmp = valA.localeCompare(valB);
            if (cmp !== 0) return cmp * dir;
          } else {
            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
          }
        }
        return 0;
      });
    }

    // Handle Select
    if (this._selectFields && Array.isArray(result)) {
      let fields = [];
      if (typeof this._selectFields === 'string') {
        fields = this._selectFields.split(' ');
      } else if (typeof this._selectFields === 'object') {
        fields = Object.keys(this._selectFields);
      }
      
      if (fields.length > 0) {
        result = result.map(doc => {
          const newDoc = {};
          fields.forEach(f => {
            if (!f.startsWith('-')) {
              newDoc[f] = doc[f];
            }
          });
          newDoc._id = doc._id; // always keep ID
          return newDoc;
        });
      }
    }

    return result;
  }

  then(onFulfilled, onRejected) {
    return this.exec().then(onFulfilled, onRejected);
  }
}

class LocalModel {
  constructor(modelName, schema) {
    this._modelName = modelName;
    this._schema = schema;
  }

  createInstance(data) {
    return new LocalDocument(this._modelName, data);
  }

  find(query = {}) {
    return new LocalQueryChain(this._modelName, async () => {
      const list = loadData(this._modelName);
      return list.filter(d => matchQuery(d, query)).map(d => new LocalDocument(this._modelName, JSON.parse(JSON.stringify(d))));
    });
  }

  findOne(query = {}) {
    return new LocalQueryChain(this._modelName, async () => {
      const list = loadData(this._modelName);
      const found = list.find(d => matchQuery(d, query));
      return found ? new LocalDocument(this._modelName, JSON.parse(JSON.stringify(found))) : null;
    });
  }

  findById(id) {
    return new LocalQueryChain(this._modelName, async () => {
      const list = loadData(this._modelName);
      const targetId = String(id || '').trim();
      const found = list.find(d => 
        String(d._id) === targetId || 
        (d.questionId && String(d.questionId).toUpperCase() === targetId.toUpperCase()) ||
        (d.trapId && String(d.trapId).toUpperCase() === targetId.toUpperCase())
      );
      return found ? new LocalDocument(this._modelName, JSON.parse(JSON.stringify(found))) : null;
    });
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const list = loadData(this._modelName);
    const targetId = String(id || '').trim();
    const idx = list.findIndex(d => 
      String(d._id) === targetId || 
      (d.questionId && String(d.questionId).toUpperCase() === targetId.toUpperCase()) ||
      (d.trapId && String(d.trapId).toUpperCase() === targetId.toUpperCase())
    );
    if (idx >= 0) {
      let doc = list[idx];
      const fieldsToUpdate = update.$set || update;
      Object.assign(doc, fieldsToUpdate);
      doc.updatedAt = new Date().toISOString();
      saveData(this._modelName);
      return new LocalDocument(this._modelName, JSON.parse(JSON.stringify(doc)));
    }
    return null;
  }

  async findByIdAndDelete(id) {
    const list = loadData(this._modelName);
    const targetId = String(id || '').trim();
    const idx = list.findIndex(d => 
      String(d._id) === targetId || 
      (d.questionId && String(d.questionId).toUpperCase() === targetId.toUpperCase()) ||
      (d.trapId && String(d.trapId).toUpperCase() === targetId.toUpperCase())
    );
    if (idx >= 0) {
      const deleted = list.splice(idx, 1)[0];
      saveData(this._modelName);
      return new LocalDocument(this._modelName, JSON.parse(JSON.stringify(deleted)));
    }
    return null;
  }

  async findOneAndDelete(query) {
    const list = loadData(this._modelName);
    const idx = list.findIndex(d => matchQuery(d, query));
    if (idx >= 0) {
      const deleted = list.splice(idx, 1)[0];
      saveData(this._modelName);
      return new LocalDocument(this._modelName, JSON.parse(JSON.stringify(deleted)));
    }
    return null;
  }

  async deleteOne(query = {}) {
    const list = loadData(this._modelName);
    const idx = list.findIndex(d => matchQuery(d, query));
    if (idx >= 0) {
      list.splice(idx, 1);
      saveData(this._modelName);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async deleteMany(query = {}) {
    const list = loadData(this._modelName);
    const initialLength = list.length;
    
    const remaining = list.filter(d => !matchQuery(d, query));
    database[this._modelName] = remaining;
    saveData(this._modelName);
    
    return { deletedCount: initialLength - remaining.length };
  }

  async insertMany(docs) {
    const list = loadData(this._modelName);
    const inserted = [];
    const now = new Date().toISOString();
    
    for (let docData of docs) {
      const doc = JSON.parse(JSON.stringify(docData));
      if (!doc._id) doc._id = generateId();
      if (!doc.createdAt) doc.createdAt = now;
      doc.updatedAt = now;
      list.push(doc);
      inserted.push(new LocalDocument(this._modelName, doc));
    }
    
    saveData(this._modelName);
    return inserted;
  }

  async countDocuments(query = {}) {
    const list = loadData(this._modelName);
    return list.filter(d => matchQuery(d, query)).length;
  }
}

const models = {};

module.exports = {
  registerModel(modelName, schema) {
    const modelInstance = new LocalModel(modelName, schema);
    
    const ClassConstructor = function(data) {
      return modelInstance.createInstance(data);
    };

    Object.assign(ClassConstructor, {
      find: modelInstance.find.bind(modelInstance),
      findOne: modelInstance.findOne.bind(modelInstance),
      findById: modelInstance.findById.bind(modelInstance),
      findByIdAndUpdate: modelInstance.findByIdAndUpdate.bind(modelInstance),
      findByIdAndDelete: modelInstance.findByIdAndDelete.bind(modelInstance),
      findOneAndDelete: modelInstance.findOneAndDelete.bind(modelInstance),
      deleteOne: modelInstance.deleteOne.bind(modelInstance),
      deleteMany: modelInstance.deleteMany.bind(modelInstance),
      insertMany: modelInstance.insertMany.bind(modelInstance),
      countDocuments: modelInstance.countDocuments.bind(modelInstance),
    });

    models[modelName] = ClassConstructor;
  },

  getModel(modelName) {
    return models[modelName];
  }
};
