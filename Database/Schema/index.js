const fs = require('fs');
const path = require('path');

// Function to extract foreign key dependencies from a table schema
function extractDependencies(schema) {
    if (!Array.isArray(schema)) {
        console.error('Invalid schema format:', schema);
        throw new TypeError('Schema must be an array of column definitions');
    }
    return schema
        .filter(column => column.type.includes('REFERENCES'))
        .map(column => column.type.match(/REFERENCES\s+(\w+)/)[1]);
}

// Function to perform topological sort
function topologicalSort(dependencies) {
    const sorted = [];
    const visited = new Set();

    function visit(node) {
        if (!visited.has(node)) {
            visited.add(node);
            (dependencies[node] || []).forEach(visit);
            sorted.push(node);
        }
    }

    Object.keys(dependencies).forEach(visit);
    return sorted;
}

const table_schemas = {};
const dependencies = {};

// Read all schema files and extract dependencies
fs.readdirSync(__dirname).forEach(file => {
    if (file.endsWith('.js') && file !== 'index.js') {
        const tableName = file.split('Table.js')[0];
        try {
            const schema = require(`./${file}`);
            table_schemas[tableName] = schema;
            dependencies[tableName] = extractDependencies(schema);
        } catch (error) {
            console.error(`Error processing file ${file}:`, error);
        }
    }
});

// Determine the order of table creation
const tableCreationOrder = topologicalSort(dependencies);

module.exports = {
    table_schemas,
    tableCreationOrder
};
