import pytest
import os
from datetime import datetime
from szurubooru import api, config, db, errors
from szurubooru.util import misc, tags, tag_categories

@pytest.fixture
def test_ctx(
        tmpdir,
        config_injector,
        context_factory,
        tag_factory,
        tag_category_factory,
        user_factory):
    config_injector({
        'data_dir': str(tmpdir),
        'privileges': {
            'tag_categories:delete': 'regular_user',
        },
        'ranks': ['anonymous', 'regular_user'],
    })
    ret = misc.dotdict()
    ret.context_factory = context_factory
    ret.user_factory = user_factory
    ret.tag_factory = tag_factory
    ret.tag_category_factory = tag_category_factory
    ret.api = api.TagCategoryDetailApi()
    return ret

def test_deleting(test_ctx):
    db.session().add(test_ctx.tag_category_factory(name='category'))
    db.session().commit()
    result = test_ctx.api.delete(
        test_ctx.context_factory(
            user=test_ctx.user_factory(rank='regular_user')),
        'category')
    assert result == {}
    assert db.session().query(db.TagCategory).count() == 0
    assert os.path.exists(os.path.join(config.config['data_dir'], 'tags.json'))

def test_deleting_with_usages(test_ctx, tag_factory):
    category = test_ctx.tag_category_factory(name='category')
    db.session().add(category)
    db.session().flush()
    tag = test_ctx.tag_factory(names=['tag'], category=category)
    db.session().add(tag)
    db.session().commit()
    with pytest.raises(tag_categories.TagCategoryIsInUseError):
        test_ctx.api.delete(
            test_ctx.context_factory(
                user=test_ctx.user_factory(rank='regular_user')),
            'category')
    assert db.session().query(db.TagCategory).count() == 1

def test_deleting_non_existing(test_ctx):
    with pytest.raises(tag_categories.TagCategoryNotFoundError):
        test_ctx.api.delete(
            test_ctx.context_factory(
                user=test_ctx.user_factory(rank='regular_user')), 'bad')

def test_deleting_without_privileges(test_ctx):
    db.session().add(test_ctx.tag_category_factory(name='category'))
    db.session().commit()
    with pytest.raises(errors.AuthError):
        test_ctx.api.delete(
            test_ctx.context_factory(
                user=test_ctx.user_factory(rank='anonymous')),
            'category')
    assert db.session().query(db.TagCategory).count() == 1