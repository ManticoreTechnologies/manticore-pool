// SQL utility for CockroachDB
const sql = {

    // Create a new database
    create_database: (database_name) => `CREATE DATABASE IF NOT EXISTS ${database_name}`,

    // Delete a database
    delete_database: (database_name) => `DROP DATABASE IF EXISTS ${database_name}`,

    // Rename a database
    rename_database: (database_name, new_database_name) => `ALTER DATABASE ${database_name} RENAME TO ${new_database_name}`,

    // Get all databases
    get_all_databases: () => `SHOW DATABASES`,

    // Create a new table
    create_table: (database_name, table_name, columns) => {
        if (!Array.isArray(columns)) {
            throw new Error('Columns must be an array');
        }
        const formattedColumns = columns.map(column => {
            if (typeof column === 'string') {
                return column;
            } else if (Array.isArray(column) && column.length === 2) {
                return `${column[0]} ${column[1]}`;
            } else if (typeof column === 'object' && column.name && column.type) {
                // Handle PRIMARY KEY specially
                if (column.type === 'PRIMARY KEY') {
                    return `${column.name} SERIAL PRIMARY KEY`;
                }
                return `${column.name} ${column.type} ${column.default ? `DEFAULT ${column.default}` : ''}`;
            } else {
                throw new Error('Invalid column format. Expected string, [name, type] array, or {name, type} object.');
            }
        });
        return `USE ${database_name}; CREATE TABLE IF NOT EXISTS ${table_name} (${formattedColumns.join(', ')})`;
    },
    delete_table: (table_name) => `DROP TABLE IF EXISTS ${table_name}`,
    rename_table: (table_name, new_table_name) => `ALTER TABLE ${table_name} RENAME TO ${new_table_name}`,
    get_all_tables: (database_name) => `SHOW TABLES FROM ${database_name}`,
    insert: (database_name, table_name, columns, values) => {
        const formattedValues = values.map(value => {
            if (value === undefined) {
                return 'NULL'; // Convert undefined to SQL NULL
            } else if (typeof value === 'string') {
                return `'${value.replace(/'/g, "''")}'`; // Escape single quotes in strings
            } else if (value instanceof Date) {
                return `'${value.toISOString()}'`; // Format Date objects as ISO strings
            } else if (typeof value === 'boolean') {
                return value ? 'TRUE' : 'FALSE'; // Convert booleans to SQL TRUE/FALSE
            } else if (typeof value === 'object') {
                try {
                    return `'${JSON.stringify(value).replace(/'/g, "''")}'`; // Convert objects to JSON strings
                } catch (e) {
                    console.error('Error serializing object to JSON:', e);
                    return 'NULL'; // Fallback to NULL if serialization fails
                }
            }
            return value;
        });
        return `USE ${database_name}; INSERT INTO ${table_name} (${columns.join(', ')}) VALUES (${formattedValues.join(', ')})`;
    },
    upsert: (database_name, table_name, columns, values, conflict_target) => {
        const formattedValues = values.map(value => {
            if (value === undefined) {
                return 'NULL'; // Convert undefined to SQL NULL
            } else if (typeof value === 'string') {
                return `'${value.replace(/'/g, "''")}'`; // Escape single quotes in strings
            } else if (value instanceof Date) {
                return `'${value.toISOString()}'`; // Format Date objects as ISO strings
            } else if (typeof value === 'boolean') {
                return value ? 'TRUE' : 'FALSE'; // Convert booleans to SQL TRUE/FALSE
            } else if (typeof value === 'object') {
                try {
                    return `'${JSON.stringify(value).replace(/'/g, "''")}'`; // Convert objects to JSON strings
                } catch (e) {
                    console.error('Error serializing object to JSON:', e);
                    return 'NULL'; // Fallback to NULL if serialization fails
                }
            }
            return value;
        });

        const updateSet = columns.map((col, index) => `${col} = ${formattedValues[index]}`).join(', ');

        return `USE ${database_name}; INSERT INTO ${table_name} (${columns.join(', ')}) VALUES (${formattedValues.join(', ')}) ON CONFLICT (${conflict_target}) DO UPDATE SET ${updateSet}`;
    },
    update_column: (database_name, table_name, column_name, data, conditions) => `USE ${database_name}; UPDATE ${table_name} SET ${column_name} = ${data} WHERE ${conditions.join(' AND ')}`,
    update_column_where: (database_name, table_name, column_name, data, conditions) => `USE ${database_name}; UPDATE ${table_name} SET ${column_name} = ${data} WHERE ${conditions.join(' AND ')}`,
    upsert_where: (database_name, table_name, columns, values, conflict_target, conditions) => {
        const formattedValues = values.map(value => {
            return value;
        });
        const updateSet = columns.map((col, index) => `${col} = ${formattedValues[index]}`).join(', ');
        return `USE ${database_name}; INSERT INTO ${table_name} (${columns.join(', ')}) VALUES (${formattedValues.join(', ')}) ON CONFLICT (${conflict_target}) DO UPDATE SET ${updateSet} WHERE ${conditions.join(' AND ')}`;
    },
    increment_column: (database_name, table_name, column_name, value=1) => `USE ${database_name}; UPDATE ${table_name} SET ${column_name} = ${column_name} + ${value}`,
    increment_columns: (database_name, table_name, columns, values) => `USE ${database_name}; UPDATE ${table_name} SET ${columns.join(', ')} = ${columns.join(', ')} + ${values.join(', ')}`,
    increment_columns_where: (database_name, table_name, columns, values, conditions) => {
        const setClauses = columns.map((col, index) => `${col} = ${col} + ${values[index]}`).join(', ');
        return `USE ${database_name}; UPDATE ${table_name} SET ${setClauses} WHERE ${conditions.join(' AND ')}`;
    },
    decrement_column: (database_name, table_name, column_name, value=1) => `USE ${database_name}; UPDATE ${table_name} SET ${column_name} = ${column_name} - ${value}`,
    delete: (table_name, conditions) => `DELETE FROM ${table_name} WHERE ${conditions.join(' AND ')}`,
    select_where: (database_name, columns, table_name, conditions) => `USE ${database_name}; SELECT ${columns} FROM ${table_name} WHERE ${conditions}`,
    select_limit: (database_name, columns, table_name, limit=100) => `USE ${database_name}; SELECT ${columns} FROM ${table_name} LIMIT ${limit}`,
    select_limit_orderBy: (database_name, columns, table_name, column, direction, limit=100) => `USE ${database_name}; SELECT ${columns} FROM ${table_name} ORDER BY ${column} ${direction} LIMIT ${limit}`,
    create_function: (database_name, function_name, function_body) => `
        USE ${database_name};
        CREATE FUNCTION ${function_name}() RETURNS INT LANGUAGE SQL AS $$
        ${function_body}    
        $$;
    `,
    call_function_on_database: (database_name, function_name) => `USE ${database_name}; SELECT ${function_name}()`,
    call_function_on_table: (database_name, table_name, function_name) => `USE ${database_name}; SELECT ${function_name}(${table_name})`,
    count_column: (database_name, table_name, column_name) => `USE ${database_name}; SELECT COUNT(*) FROM ${table_name} WHERE ${column_name} IS NOT NULL`,
    count_where: (database_name, table_name, conditions) => `USE ${database_name}; SELECT COUNT(*) FROM ${table_name} WHERE ${conditions.join(' AND ')}`,
};

module.exports = sql;