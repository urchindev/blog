const React = require('react/addons');
const ReactUpdates = require('react/lib/ReactUpdates');
const { slugify, mergeObj, invariant, Element, Elements } = require('../lib/util');
const { connect } = require('../lib/redux');
const csp = require('js-csp');
const { go, chan, take, put, ops } = csp;
const { currentDate } = require("../lib/date");
const dom = React.DOM;
const api = require('impl/api');
const classNames = require('classnames');
const withLocalState = require('../lib/local-state');

const actions = require('../actions');
const constants = require('../constants');

const Editor = Element(require('./components/editor'));
const Toolbar = Element(require('./components/toolbar'));
const Settings = Element(require('./components/settings'));
const Pane = Element(require('./components/pane'));


const Edit = React.createClass({
  displayName: 'Edit',

  getInitialState: function() {
    return {
      post: this.props.post,
      validationError: null
    };
  },

  // componentWillMount: function() {
  //   console.log(this.state);
  // },

  componentWillReceiveProps: function(nextProps) {
    // relocate('/');

    if(this.props.post.shorturl !== nextProps.post.shorturl) {
      this.setState({ post: nextProps.post });
    }
  },

  componentDidMount: function() {
    require(['static/css/editor.less']);
  },

  validate: function(post) {
    if(post.published &&
       this.props.post.shorturl !== post.shorturl) {
      this.setState({
        post: mergeObj(post, { shorturl: this.props.post.shorturl }),
        validationError: {
          field: 'shorturl',
          msg: 'Cannot change the URL of a published post'
        }
      });

      return false;
    }

    this.setState({ validationError: null });
    return true;
  },

  handleSettingsChange: function(name, value) {
    let updates = {}
    if(name === 'tags') {
      updates[name] = value.split(',');
    }
    else {
      updates[name] = value;
    }
    this.setState({ post: mergeObj(this.state.post, updates) });
  },

  handleChange: function(text) {
    let match = text.match(/^\s*# ([^\n]*)\n\n/m);
    if(!match) {
      console.log('badly-formed document');
      return;
    }

    let post = this.state.post;
    let updates = {};
    updates.title = match[1];
    updates.content = text.slice(match[0].length);
    if(!this.props.post.shorturl) {
      updates.shorturl = post.title ? slugify(post.title) : '';
    }

    this.setState({ post: mergeObj(post, updates)});
  },

  handleSave: function() {
    let post = this.state.post;
    if(!post.published || !post.date) {
      post = mergeObj(post, { date: currentDate() });
    }

    if(!this.validate(post)) {
      return;
    }

    this.props.actions.savePost(this.props.post, post);
  },

  handleDelete: function() {
    if(confirm('Are you sure?')) {
      this.props.actions.deletePost(this.state.post.shorturl);
    }
  },

  render: function () {
    let ui = this.props.ui;
    let post = this.state.post;
    let actions = this.props.actions;

    if(!post.shorturl && this.props.queryParams.post !== 'new') {
      return dom.div(
        { className: 'edit-container' },
        dom.div({ className: 'edit-main'}, 'no post found')
      );
    }

    let doc = '\n# ' + post.title + '\n\n' + post.content;

    return dom.div(
      { className: 'edit-container' },
      //Feedback(),
      Toolbar({ title: post.title,
                date: post.date,
                shorturl: post.shorturl,
                onSave: this.handleSave,
                onDelete: this.handleDelete,
                onShowSettings: actions.toggleSettings,
                onShowPreview: actions.togglePreview }),
      dom.div(
        { className: 'edit-main' },
        Editor({ url: post.shorturl,
                 content: doc,
                 onChange: this.handleChange,
                 className: ui.showPreview ? 'uncentered' : '' }),
        dom.a({ href: '#',
                className: 'settings',
                onClick: actions.toggleSettings },
              "Settings \u2192"),
        // dom.a({ href: '#',
        //         className: 'preview',
        //         onClick: actions.togglePreview },
        //       "\u2190 Preview"),
        Pane(
          { width: 500,
            side: "left",
            open: ui.showSettings,
            onClose: actions.toggleSettings },
          Settings({
            post: post,
            validationError: this.state.validationError,
            onClose: actions.toggleSettings,
            onChange: this.handleSettingsChange
          })
        ),
        dom.div(
          { className: 'preview',
            style: { width: ui.showPreview ? 200 : 0 } },
          dom.div({ onClick: actions.togglePreview },
                  "SHOW ME DAT PREVIEW")
        )
      )
    );
  }
});

module.exports = connect(withLocalState(Edit), {
  pageClass: 'edit',
  actions: actions,

  runQueries: function(dispatch, state, params) {
    const id = decodeURI(params.post);
    dispatch(actions.getPost(id));
  },

  select: function(state, params) {
    const id = decodeURI(params.post);
    const post = state.posts.getIn(['postsById', id]);
    return {
      post: post || {
        title: '',
        content: '',
        published: false
      },
      ui: state.editor
    }
  }
});