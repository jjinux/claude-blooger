import type { MigrationInterface, QueryRunner } from 'typeorm'

export class InitialSchema1788825504998 implements MigrationInterface {
    name = 'InitialSchema1788825504998'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`posts\` (
                \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
                \`user_id\` int UNSIGNED NOT NULL,
                \`title\` varchar(255) NOT NULL,
                \`body\` text NOT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                INDEX \`idx_posts_user_id_created_at\` (\`user_id\`, \`created_at\`),
                INDEX \`idx_posts_created_at\` (\`created_at\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
        await queryRunner.query(`
            CREATE TABLE \`users\` (
                \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
                \`username\` varchar(64) NOT NULL,
                \`password_hash\` varchar(255) NOT NULL,
                \`bloog_title\` varchar(128) NOT NULL,
                \`is_admin\` tinyint NOT NULL DEFAULT 0,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`idx_users_username\` (\`username\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
        await queryRunner.query(`
            CREATE TABLE \`sessions\` (
                \`id\` varchar(128) NOT NULL,
                \`user_id\` int UNSIGNED NULL,
                \`expires_at\` datetime(6) NOT NULL,
                \`data\` text NOT NULL,
                INDEX \`idx_sessions_expires_at\` (\`expires_at\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
        await queryRunner.query(`
            ALTER TABLE \`posts\`
            ADD CONSTRAINT \`FK_c4f9a7bd77b489e711277ee5986\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`sessions\`
            ADD CONSTRAINT \`FK_085d540d9f418cfbdc7bd55bb19\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`sessions\` DROP FOREIGN KEY \`FK_085d540d9f418cfbdc7bd55bb19\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`posts\` DROP FOREIGN KEY \`FK_c4f9a7bd77b489e711277ee5986\`
        `);
        await queryRunner.query(`
            DROP INDEX \`idx_sessions_expires_at\` ON \`sessions\`
        `);
        await queryRunner.query(`
            DROP TABLE \`sessions\`
        `);
        await queryRunner.query(`
            DROP INDEX \`idx_users_username\` ON \`users\`
        `);
        await queryRunner.query(`
            DROP TABLE \`users\`
        `);
        await queryRunner.query(`
            DROP INDEX \`idx_posts_created_at\` ON \`posts\`
        `);
        await queryRunner.query(`
            DROP INDEX \`idx_posts_user_id_created_at\` ON \`posts\`
        `);
        await queryRunner.query(`
            DROP TABLE \`posts\`
        `);
    }

}
