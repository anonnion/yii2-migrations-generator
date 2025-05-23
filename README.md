# SQL to Yii2 Migration Generator 🚀

A powerful Node.js script that converts SQL schema files into Yii2-compatible database migrations. Perfect for converting existing database structures or SQL dumps into Yii2 migration files.

![GitHub](https://img.shields.io/badge/license-MIT-blue)
![Node Version](https://img.shields.io/badge/node-%3E%3D14.x-green)

## Features ✨

- **Automatic Conversion** - Convert SQL `CREATE TABLE` and `ALTER TABLE` statements to Yii2 migrations
- **Smart Type Mapping** - Handles common SQL types (int, varchar, enum, etc.) and converts them to Yii2 column types
- **Constraint Support** - Processes primary keys, foreign keys, indexes, and unique constraints
- **Table Options** - Preserves engine types and character sets (MyISAM/InnoDB, UTF-8, etc.)
- **Alter Table Handling** - Converts `ALTER TABLE` statements to separate migration files
- **Error Resilient** - Skips invalid SQL statements and provides helpful warnings

## Installation 📦

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/sql-to-yii2-migrations.git
   cd sql-to-yii2-migrations
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

## Usage 🛠️

1. **Prepare your SQL schema file**
   - Place your SQL dump in the project root as `schema.sql`
   - Example format:
     ```sql
     CREATE TABLE `users` (
       `id` int(11) NOT NULL AUTO_INCREMENT,
       `username` varchar(255) NOT NULL,
       PRIMARY KEY (`id`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
     ```

2. **Generate migrations**
   ```bash
   node generate.js
   ```

3. **Find generated files**
   - Created in `./migrations` directory
   - Example output:
     ```
     migrations/
     ├── m202306011200_create_table_users.php
     └── m202306011201_alter_table_users.php
     ```

## Configuration ⚙️

Customize via constants at the top of `generate.js`:

```javascript
// CONFIG
const inputFile = 'schema.sql';         // Input SQL file
const outputDir = './migrations';       // Output directory
const migrationNamePrefix = 'create_table_'; // Migration name prefix
const alterMigrationPrefix = 'alter_';  // Prefix for alter migrations
```

## Supported SQL Features ✅

| SQL Feature          | Yii2 Equivalent                    |
|----------------------|------------------------------------|
| CREATE TABLE         | createTable()                     |
| ALTER TABLE          | addColumn(), alterColumn(), etc.  |
| Column Types         | integer(), string(), text(), etc. |
| Primary Keys         | primaryKey()                      |
| Foreign Keys         | addForeignKey()                   |
| Indexes/Unique Keys  | createIndex()                     |
| Table Options        | Engine and charset options        |
| Column Modifiers     | ->notNull(), ->defaultValue()     |

## Example Workflow 🔄

**Input SQL** (`schema.sql`):
```sql
CREATE TABLE `posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` text,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `posts`
  ADD COLUMN `views` int(11) NOT NULL DEFAULT 0,
  ADD INDEX `idx_views` (`views`);
```

**Generated Migration** (`m202306011200_create_table_posts.php`):
```php
<?php
use yii\db\Migration;

class m202306011200_create_table_posts extends Migration
{
    public function safeUp()
    {
        $this->createTable('{{%posts}}', [
            'id' => $this->primaryKey(),
            'title' => $this->string(255)->notNull(),
            'content' => $this->text(),
            'created_at' => $this->dateTime()->notNull(),
        ], 'ENGINE=InnoDB, DEFAULT CHARSET=utf8mb4');
    }

    public function safeDown()
    {
        $this->dropTable('{{%posts}}');
    }
}
```

**Generated Alter Migration** (`m202306011201_alter_table_posts.php`):
```php
<?php
use yii\db\Migration;

class m202306011201_alter_table_posts extends Migration
{
    public function safeUp()
    {
        $this->addColumn('{{%posts}}', 'views', $this->integer()->notNull()->defaultValue(0));
        $this->createIndex('idx_views', '{{%posts}}', 'views');
    }

    public function safeDown()
    {
        $this->dropIndex('idx_views', '{{%posts}}');
        $this->dropColumn('{{%posts}}', 'views');
    }
}
```

## Contributing 🤝

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/awesome-feature`)
3. Commit your changes (`git commit -am 'Add awesome feature'`)
4. Push to the branch (`git push origin feature/awesome-feature`)
5. Open a Pull Request

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Happy Migrating!** 🎉 If you find this tool useful, please consider giving it a ⭐ on GitHub!
