import {Posts} from './models/posts.js';
import mojo, {yamlConfigPlugin} from '@mojojs/core';
import Pg from '@mojojs/pg';

export const app = mojo();
app.plugin(yamlConfigPlugin);
app.secrets = app.config.secrets;

app.onStart(async app => {
  if (app.models.pg === undefined) app.models.pg = new Pg(app.config.pg);
  app.models.posts = new Posts(app.models.pg);

  const migrations = app.models.pg.migrations;
  await migrations.fromFile(app.home.child('migrations', 'blog.sql'), {name: 'blog'});
  await migrations.migrate();
});

app.get('/', ctx => ctx.redirectTo('posts'));
app.get('/posts').to('posts#index');
app.get('/posts/create').to('posts#create').name('create_post');
app.post('/posts').to('posts#store').name('store_post');
app.get('/posts/:id').to('posts#show').name('show_post');
app.get('/posts/:id/edit').to('posts#edit').name('edit_post');
app.put('/posts/:id').to('posts#update').name('update_post');
app.delete('/posts/:id').to('posts#remove').name('remove_post');

app.start();
