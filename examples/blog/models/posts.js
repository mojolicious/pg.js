export class Posts {
  constructor(pg) {
    this.pg = pg;
  }

  async add(post) {
    return (await this.pg.query`INSERT INTO posts (title, body) VALUES (${post.title}, ${post.body}) RETURNING id`)
      .first.id;
  }

  async all() {
    return await this.pg.query`SELECT * FROM posts`;
  }

  async find(id) {
    return (await this.pg.query`SELECT * FROM posts WHERE id = ${id}`).first;
  }

  async remove(id) {
    await this.pg.query`DELETE FROM posts WHERE id = ${id}`;
  }

  async save(id, post) {
    await this.pg.query`UPDATE posts SET title = ${post.title}, body = ${post.body} WHERE id = ${id}`;
  }
}
