const fs = require('fs');
const path = require('path');

// CONFIG
const inputFile = 'schema.sql';
const outputDir = './console/migrations';
const migrationNamePrefix = 'create_table_';


// SQL to Yii2 type mapping (enhanced)
const typeMap = {
  int: 'integer()',
  bigint: 'bigInteger()',
  tinyint: 'tinyInteger()',
  smallint: 'smallInteger()',
  varchar: size => `string(${size})`,
  char: size => `char(${size})`,
  text: 'text()',
  mediumtext: 'text()',
  longtext: 'text()',
  datetime: 'dateTime()',
  timestamp: 'timestamp()',
  time: 'time()',
  date: 'date()',
  float: 'float()',
  double: 'double()',
  decimal: (precision, scale) => `decimal(${precision}, ${scale})`,
  boolean: 'boolean()',
  json: 'json()',
  enum: values => `string()->check("\\"IN (${values.replace(/"/g, '\'')}\\"")")`,
};

// Helper to escape quotes in ENUM values
function escapeEnumValues(values) {
  return values.replace(/"/g, "'"); // Escape single quotes for PHP
}

// Helper: map column definition to Yii2 type
function parseColumn(line) {
  // Skip constraints and indexes
  if (/^\s*(PRIMARY KEY|KEY|CONSTRAINT|FOREIGN KEY|UNIQUE KEY|INDEX)/i.test(line)) {
    return null;
  }

  // Match column definitions with optional backticks and various modifiers
  const colMatch = line.match(/^\s*`?(\w+)`?\s+([a-z]+)(?:\(([^)]+)\))?\s*(.*)/i);
  if (!colMatch) return null;

  const [, name, typeRaw, length, rest] = colMatch;
  let type = typeRaw.toLowerCase();
  let yiiType;

  // Handle special types
  if (type === 'enum') {
    const enumValuesMatch = line.match(/enum\(([^)]+)\)/i);
    if (enumValuesMatch) {
      const escapedValues = escapeEnumValues(enumValuesMatch[1]);
      yiiType = `string()->check("\\"IN (${escapedValues})\\"")`;
    }
  } else if (type in typeMap) {
    if (type === 'decimal' && length) {
      const [precision, scale] = length.split(',').map(Number);
      yiiType = typeMap.decimal(precision, scale || 0);
    } else {
      yiiType = typeof typeMap[type] === 'function' 
        ? typeMap[type](length) 
        : typeMap[type];
    }
  } else {
    yiiType = 'string()';
  }

  // Process modifiers
  const modifiers = rest.replace(/,\s*$/, ''); // Remove trailing comma
  if (modifiers.includes('NOT NULL')) yiiType += '->notNull()';
  if (modifiers.includes('AUTO_INCREMENT')) yiiType += '->append("AUTO_INCREMENT")';
  
  // Default values
  const defaultMatch = modifiers.match(/DEFAULT\s+('?[^'\s,]+'?|\d+)/i);
  if (defaultMatch) {
    let defVal = defaultMatch[1];
    let def;
    if (!/^\d+$/.test(defVal)) {
      def = defVal = defVal.replace(/^'|'$/g, '');
      defVal = `'${defVal}'`;
    }
    yiiType += def == "CURRENT_TIMESTAMP" ? `->defaultExpression(${defVal})` : `->defaultValue(${defVal})`;
  }

  // Comments
  const commentMatch = modifiers.match(/COMMENT\s+'([^']+)'/i);
  if (commentMatch) {
    yiiType += `->comment("${commentMatch[1]}")`;
  }

  return `            '${name}' => $this->${yiiType},`;
}


// Parse ALTER TABLE statements
function parseAlterTable(sql) {
  const alters = [];
  const alterRegex = /ALTER TABLE `?(\w+)`?\s+((?:ADD|MODIFY)\s+.+?);/gis;
  
  let match;
  while ((match = alterRegex.exec(sql)) !== null) {
    const [fullMatch, tableName, clause] = match;
    alters.push({ tableName, clause: clause.trim() });
  }
  
  return alters;
}

// Parse table options
function parseTableOptions(stmt) {
  const optionsMatch = stmt.match(/ENGINE=(\w+).*DEFAULT CHARSET=(\w+)/i);
  if (!optionsMatch) return '';
  return `'ENGINE=${optionsMatch[1]}, DEFAULT CHARSET=${optionsMatch[2]}'`;
}

// Generate migration for ALTER statements
function generateAlterMigrations(alters) {
  const alterGroups = new Map();

  alters.forEach(({ tableName, clause }) => {
    if (!alterGroups.has(tableName)) {
      alterGroups.set(tableName, []);
    }
    alterGroups.get(tableName).push(clause);
  });
  let i = -1;
  alterGroups.forEach((clauses, tableName) => {
    i++;
    const className = `m${generateTimestamp()}_alter_z${tableName}`;
    
    const operations = clauses.map(clause => {
      if (clause.startsWith('ADD CONSTRAINT')) {
        const fkMatch = clause.match(/ADD CONSTRAINT `(\w+)` FOREIGN KEY \(`(\w+)`\) REFERENCES `(\w+)` \(`(\w+)`\)( ON DELETE (\w+))?/);
        return `        $this->addForeignKey('${fkMatch[1]}', '{{%${tableName}}}', '${fkMatch[2]}', '{{%${fkMatch[3]}}}', '${fkMatch[4]}'${fkMatch[5] ? `, '${fkMatch[6]}'` : ''});`;
      }
      
      if (clause.startsWith('ADD PRIMARY KEY')) {
        const cols = clause.match(/\(`(.+)`\)/)[1].split('`,`');
        return `        $this->addPrimaryKey('pk_${tableName}_${cols.join('_')}', '{{%${tableName}}}', ['${cols.join("', '")}']);`;
      }
      
      if (clause.startsWith('MODIFY')) {
        const colDef = clause.replace(/MODIFY\s+/i, '');
        const column = parseColumn(colDef);
        return `        $this->alterColumn('{{%${tableName}}}', '${column.split("'")[1]}', ${column.split('=> ')[1]});`;
      }
      
      if (clause.startsWith('ADD UNIQUE KEY')) {
        const match = clause.match(/ADD UNIQUE KEY `(\w+)` \(`(\w+)`\)/);
        return `        $this->createIndex('${match[1]}', '{{%${tableName}}}', '${match[2]}', true);`;
      }
      
      return `        // Unhandled operation: ${clause}`;
    }).join('\n');

    const content = `<?php

use yii\\db\\Migration;

class ${className} extends Migration
{
    public function safeUp()
    {
${operations}
    }

    public function safeDown()
    {
        // Revert logic here
    }
}
`;

    fs.writeFileSync(path.join(outputDir, `${className}.php`), content);
    console.log(`✅ Generated: ${className}.php`);
  });
}

/**
 * Generates a timestamp string in the format mYYMMDD_HHmmss.
 *
 * @returns {string} The formatted timestamp string.
 */
var count = 0;
function generateTimestamp() {
    count++;
    const dateObj = new Date(Date.now()+(count * 1000));
  const year = dateObj.getFullYear().toString().substring(2); // Get last two digits of the year
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
  const day = dateObj.getDate().toString().padStart(2, '0');
  const hours = dateObj.getHours().toString().padStart(2, '0');
  const minutes = dateObj.getMinutes().toString().padStart(2, '0');
  const seconds = dateObj.getSeconds().toString().padStart(2, '0');

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Main function
function generateMigrations() {
  try {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const sql = fs.readFileSync(inputFile, 'utf8');
    let done = false;
    const tables = sql.match(/CREATE TABLE `?([^\s`]+)`?\s*\(([\s\S]+?)\)*(ENGINE=[^;]+|;)/gi) || [];
    // console.log(tables.join("\n\n\n"));
    tables.forEach((stmt, i) => {
      const [, tableName, body] = stmt.match(/CREATE TABLE `(\w+)` \(([\s\S]*)\)*(?:ENGINE=[^;]+)?;?/);
    //   console.log("tableName: ", tableName,"/n", "body: ", body, "/n/n");
      // Process each line of the table definition
      const columns = body.split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('--')) // Skip comments
        .map(parseColumn)
        .filter(Boolean)
        .join('\n');

      const tableOptions = parseTableOptions(stmt);
      const className = `m${generateTimestamp()}_${migrationNamePrefix}${tableName}`;
      const content = `<?php

use yii\\db\\Migration;

/**
 * Handles the creation of table \`${tableName}\`.
 */
class ${className} extends Migration
{
    public function safeUp()
    {
        $this->createTable('{{%${tableName}}}', [
${columns}
        ]${tableOptions ? `, ${tableOptions}` : ''});
    }

    public function safeDown()
    {
        $this->dropTable('{{%${tableName}}}');
    }
}
`;
        const finalContent = content.replaceAll('this->string(undefined)', 'this->string()').replaceAll("'NULL'", "NULL");
      fs.writeFileSync(path.join(outputDir, `${className}.php`), finalContent);
      console.log(`✅ Generated: ${className}.php`);
      if(tables.length == i+1) {
          done = true;
        }
    });
    
    console.log(`\n🎉 Done. ${tables.length} migrations created.`);
    if(done === true) {
        setTimeout(() => {
            console.log(`👉 Generating alter table migrations...`);
            // Process ALTER TABLE
            const alters = parseAlterTable(sql);
            generateAlterMigrations(alters);
        }, 200);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateMigrations();
