export default class PostsController {
  async create(ctx) {
    ctx.stash.post = {};
    await ctx.render();
  }

  async edit(ctx) {
    ctx.stash.post = await ctx.models.posts.find(ctx.stash.id);
    await ctx.render();
  }

  async index(ctx) {
    ctx.stash.posts = await ctx.models.posts.all();
    await ctx.render();
  }

  async remove(ctx) {
    await ctx.models.posts.remove(ctx.stash.id);
    await ctx.redirectTo('posts');
  }

  async show(ctx) {
    ctx.stash.post = await ctx.models.posts.find(ctx.stash.id);
    await ctx.render();
  }

  async store(ctx) {
    const post = (await ctx.params()).toObject();
    if (_validate(ctx, post) === false) return ctx.render({view: 'posts/create'}, {post});

    const id = await ctx.models.posts.add(post);
    await ctx.redirectTo('show_post', {values: {id}});
  }

  async update(ctx) {
    const post = (await ctx.params()).toObject();
    if (_validate(ctx, post) === false) return ctx.render({view: 'posts/edit'}, {post});

    const id = ctx.stash.id;
    await ctx.models.posts.save(id, post);
    await ctx.redirectTo('show_post', {values: {id}});
  }
}

function _validate(ctx, post) {
  const validate = ctx.schema({
    $id: 'postForm',
    type: 'object',
    properties: {
      title: {
        type: 'string',
        minLength: 1
      },
      body: {
        type: 'string',
        minLength: 1
      }
    },
    required: ['title', 'body']
  });
  return validate(post).isValid;
}
