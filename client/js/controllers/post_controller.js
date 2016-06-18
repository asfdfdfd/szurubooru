'use strict';

const api = require('../api.js');
const misc = require('../util/misc.js');
const settings = require('../models/settings.js');
const Comment = require('../models/comment.js');
const Post = require('../models/post.js');
const topNavigation = require('../models/top_navigation.js');
const PostView = require('../views/post_view.js');
const EmptyView = require('../views/empty_view.js');

class PostController {
    constructor(id, editMode) {
        topNavigation.activate('posts');

        Promise.all([
                Post.get(id),
                api.get(`/post/${id}/around?fields=id&query=` +
                    this._decorateSearchQuery('')),
        ]).then(responses => {
            const [post, aroundResponse] = responses;
            this._post = post;
            this._view = new PostView({
                post: post,
                editMode: editMode,
                nextPostId: aroundResponse.next ? aroundResponse.next.id : null,
                prevPostId: aroundResponse.prev ? aroundResponse.prev.id : null,
                canEditPosts: api.hasPrivilege('posts:edit'),
                canListComments: api.hasPrivilege('comments:list'),
                canCreateComments: api.hasPrivilege('comments:create'),
            });
            if (this._view.sidebarControl) {
                this._view.sidebarControl.addEventListener(
                    'favorite', e => this._evtFavoritePost(e));
                this._view.sidebarControl.addEventListener(
                    'unfavorite', e => this._evtUnfavoritePost(e));
                this._view.sidebarControl.addEventListener(
                    'score', e => this._evtScorePost(e));
            }
            if (this._view.commentFormControl) {
                this._view.commentFormControl.addEventListener(
                    'change', e => this._evtCommentChange(e));
                this._view.commentFormControl.addEventListener(
                    'submit', e => this._evtCreateComment(e));
            }
            if (this._view.commentListControl) {
                this._view.commentListControl.addEventListener(
                    'change', e => this._evtUpdateComment(e));
                this._view.commentListControl.addEventListener(
                    'score', e => this._evtScoreComment(e));
                this._view.commentListControl.addEventListener(
                    'delete', e => this._evtDeleteComment(e));
            }
        }, response => {
            this._view = new EmptyView();
            this._view.showError(response.description);
        });
    }

    _decorateSearchQuery(text) {
        const browsingSettings = settings.get();
        let disabledSafety = [];
        for (let key of Object.keys(browsingSettings.listPosts)) {
            if (browsingSettings.listPosts[key] === false) {
                disabledSafety.push(key);
            }
        }
        if (disabledSafety.length) {
            text = `-rating:${disabledSafety.join(',')} ${text}`;
        }
        return text.trim();
    }

    _evtCommentChange(e) {
        misc.enableExitConfirmation();
    }

    _evtCreateComment(e) {
        // TODO: disable form
        const comment = Comment.create(this._post.id);
        comment.text = e.detail.text;
        comment.save()
            .then(() => {
                this._post.comments.add(comment);
                this._view.commentFormControl.setText('');
                // TODO: enable form
                misc.disableExitConfirmation();
            }, errorMessage => {
                this._view.commentFormControl.showError(errorMessage);
                // TODO: enable form
            });
    }

    _evtUpdateComment(e) {
        // TODO: disable form
        e.detail.comment.text = e.detail.text;
        e.detail.comment.save()
            .catch(errorMessage => {
                e.detail.target.showError(errorMessage);
                // TODO: enable form
            });
    }

    _evtScoreComment(e) {
        e.detail.comment.setScore(e.detail.score)
            .catch(errorMessage => {
                window.alert(errorMessage);
            });
    }

    _evtDeleteComment(e) {
        e.detail.comment.delete()
            .catch(errorMessage => {
                window.alert(errorMessage);
            });
    }

    _evtScorePost(e) {
        e.detail.post.setScore(e.detail.score)
            .catch(errorMessage => {
                window.alert(errorMessage);
            });
    }

    _evtFavoritePost(e) {
        e.detail.post.addToFavorites()
            .catch(errorMessage => {
                window.alert(errorMessage);
            });
    }

    _evtUnfavoritePost(e) {
        e.detail.post.removeFromFavorites()
            .catch(errorMessage => {
                window.alert(errorMessage);
            });
    }
}

module.exports = router => {
    router.enter('/post/:id', (ctx, next) => {
        ctx.controller = new PostController(ctx.params.id, false);
    });
    router.enter('/post/:id/edit', (ctx, next) => {
        ctx.controller = new PostController(ctx.params.id, true);
    });
};