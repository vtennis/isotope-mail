import React, {Component, Fragment} from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import TopBar from './top-bar/top-bar';
import SideBar from './side-bar/side-bar';
import MessageEditor from './message-editor/message-editor';
import MessageList from './message-list/message-list';
import MessageViewer from './message-viewer/message-viewer';
import MessageSnackbar from './message-snackbar/message-snackbar';
import {editNewMessage} from '../services/application';
import {getFolders} from '../services/folder';
import {preloadMessages, resetFolderMessagesCache} from '../services/message';
import mainCss from '../styles/main.scss';
import styles from './app.scss';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      sideBar: {
        collapsed: false
      }
    };
    this.toggleSideBar = this.toggleSideBar.bind(this);
  }

  render() {
    return (
      <div className={styles.app}>
        <TopBar sideBarCollapsed={this.state.sideBar.collapsed} sideBarToggle={this.toggleSideBar}/>
        <SideBar collapsed={this.state.sideBar.collapsed} sideBarToggle={this.toggleSideBar}/>
        <div className={`${mainCss['mdc-top-app-bar--fixed-adjust']} ${styles['content-wrapper']}
            ${this.state.sideBar.collapsed ? '' : styles['with-side-bar']}`}>
          {this.renderContent()}
        </div>
        <MessageSnackbar/>
      </div>
    );
  }

  renderContent() {
    const {application, outbox} = this.props;
    if (application.newMessage && Object.keys(application.newMessage).length > 0) {
      return <MessageEditor className={styles['message-viewer']} />;
    } else if (application.selectedMessage && Object.keys(application.selectedMessage).length > 0) {
      return <MessageViewer className={styles['message-viewer']} />;
    }
    return (
      <Fragment>
        <MessageList className={styles['message-grid']} />
        <div className={styles['fab-container']}>
          {outbox === null ?
            <button className={`${mainCss['mdc-fab']}`} onClick={this.props.newMessage.bind(this)}>
              <span className={`material-icons ${mainCss['mdc-fab__icon']}`}>edit</span>
            </button>
            : null}
        </div>
      </Fragment>
    );
  }

  componentDidMount() {
    document.title = this.props.application.title;
    this.startPoll();
  }

  componentDidUpdate() {
    this.startPoll();
  }

  componentWillUnmount() {
    clearTimeout(this.refreshPollTimeout);
  }

  startPoll() {
    // Start polling when everything is ready
    if (this.props.application.selectedFolderId && Object.keys(this.props.folders.explodedItems).length > 0
      && !this.pollStarted) {
      this.pollStarted = true;
      this.refreshPoll();
    }
  }

  /**
   * Poll function that will refresh the folder list and the INBOX folder.
   *
   * @returns {Promise<void>}
   */
  async refreshPoll() {
    try {
      const messagesToPreload = 15;
      const folderPromise = this.props.reloadFolders();
      const selectedFolder = this.props.folders.explodedItems[this.props.application.selectedFolderId] || {};
      const messagePromise = this.props.reloadMessageCache(selectedFolder);
      await Promise.all([folderPromise, messagePromise]);
      // Preload latest received messages if applicable
      const activeMessageList = this.props.messages.cache[this.props.application.selectedFolderId];
      if (activeMessageList) {
        const latestMessagesUids = Array.from(activeMessageList.values())
          .slice(0, messagesToPreload)
          .filter(m => !Object.keys(this.props.application.downloadedMessages).includes(m.messageId))
          .map(m => m.uid);
        this.props.preloadMessages(selectedFolder, latestMessagesUids);
      }
    } catch (e) {
      console.log(`Error in refresh poll: ${e}`);
    }
    this.refreshPollTimeout = setTimeout(this.refreshPoll.bind(this), this.props.application.pollInterval);
  }

  toggleSideBar() {
    const toggleCollapsed = !this.state.sideBar.collapsed;
    this.setState({
      sideBar: {
        collapsed: toggleCollapsed
      }
    });
  }
}

App.propTypes = {
  application: PropTypes.object,
  outbox: PropTypes.object,
  folders: PropTypes.object,
  reloadFolders: PropTypes.func,
  reloadMessageCache: PropTypes.func,
  newMessage: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
  application: state.application,
  outbox: state.application.outbox,
  folders: state.folders,
  messages: state.messages
});

const mapDispatchToProps = dispatch => ({
  reloadFolders: credentials => getFolders(dispatch, credentials, true),
  reloadMessageCache: (user, folder) => resetFolderMessagesCache(dispatch, user, folder),
  newMessage: () => editNewMessage(dispatch),
  preloadMessages: (credentials, folder, messageUids) => preloadMessages(dispatch, credentials, folder, messageUids)
});

const mergeProps = (stateProps, dispatchProps, ownProps) => (Object.assign({}, stateProps, dispatchProps, ownProps, {
  reloadFolders: () => dispatchProps.reloadFolders(stateProps.application.user.credentials),
  reloadMessageCache: folder => dispatchProps.reloadMessageCache(stateProps.application.user, folder),
  preloadMessages: (folder, messageUids) =>
    dispatchProps.preloadMessages(stateProps.application.user.credentials, folder, messageUids)
}));

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(App);
