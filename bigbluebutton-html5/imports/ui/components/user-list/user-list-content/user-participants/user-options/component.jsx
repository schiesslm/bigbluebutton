import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { defineMessages, injectIntl } from 'react-intl';
import _ from 'lodash';
import { withModalMounter } from '/imports/ui/components/modal/service';
import Button from '/imports/ui/components/button/component';
import Dropdown from '/imports/ui/components/dropdown/component';
import LockViewersContainer from '/imports/ui/components/lock-viewers/container';
import GuestPolicyContainer from '/imports/ui/components/waiting-users/guest-policy/container';
import BreakoutRoom from '/imports/ui/components/actions-bar/create-breakout-room/container';
import CaptionsService from '/imports/ui/components/captions/service';
import CaptionsWriterMenu from '/imports/ui/components/captions/writer-menu/container';
import { styles } from './styles';
import { getUserNamesLink } from '/imports/ui/components/user-list/service';
import Settings from '/imports/ui/services/settings';

const propTypes = {
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
  isMeetingMuted: PropTypes.bool.isRequired,
  toggleMuteAllUsers: PropTypes.func.isRequired,
  toggleMuteAllUsersExceptPresenter: PropTypes.func.isRequired,
  toggleStatus: PropTypes.func.isRequired,
  mountModal: PropTypes.func.isRequired,
  users: PropTypes.arrayOf(Object).isRequired,
  guestPolicy: PropTypes.string.isRequired,
  meetingIsBreakout: PropTypes.bool.isRequired,
  hasBreakoutRoom: PropTypes.bool.isRequired,
  isBreakoutEnabled: PropTypes.bool.isRequired,
  isBreakoutRecordable: PropTypes.bool.isRequired,
  dynamicGuestPolicy: PropTypes.bool.isRequired,
};

const intlMessages = defineMessages({
  optionsLabel: {
    id: 'app.userList.userOptions.manageUsersLabel',
    description: 'Manage user label',
  },
  clearAllLabel: {
    id: 'app.userList.userOptions.clearAllLabel',
    description: 'Clear all label',
  },
  clearAllDesc: {
    id: 'app.userList.userOptions.clearAllDesc',
    description: 'Clear all description',
  },
  muteAllLabel: {
    id: 'app.userList.userOptions.muteAllLabel',
    description: 'Mute all label',
  },
  muteAllDesc: {
    id: 'app.userList.userOptions.muteAllDesc',
    description: 'Mute all description',
  },
  unmuteAllLabel: {
    id: 'app.userList.userOptions.unmuteAllLabel',
    description: 'Unmute all label',
  },
  unmuteAllDesc: {
    id: 'app.userList.userOptions.unmuteAllDesc',
    description: 'Unmute all desc',
  },
  lockViewersLabel: {
    id: 'app.userList.userOptions.lockViewersLabel',
    description: 'Lock viewers label',
  },
  lockViewersDesc: {
    id: 'app.userList.userOptions.lockViewersDesc',
    description: 'Lock viewers description',
  },
  guestPolicyLabel: {
    id: 'app.userList.userOptions.guestPolicyLabel',
    description: 'Guest policy label',
  },
  guestPolicyDesc: {
    id: 'app.userList.userOptions.guestPolicyDesc',
    description: 'Guest policy description',
  },
  muteAllExceptPresenterLabel: {
    id: 'app.userList.userOptions.muteAllExceptPresenterLabel',
    description: 'Mute all except presenter label',
  },
  muteAllExceptPresenterDesc: {
    id: 'app.userList.userOptions.muteAllExceptPresenterDesc',
    description: 'Mute all except presenter description',
  },
  createBreakoutRoom: {
    id: 'app.actionsBar.actionsDropdown.createBreakoutRoom',
    description: 'Create breakout room option',
  },
  createBreakoutRoomDesc: {
    id: 'app.actionsBar.actionsDropdown.createBreakoutRoomDesc',
    description: 'Description of create breakout room option',
  },
  invitationItem: {
    id: 'app.invitation.title',
    description: 'invitation to breakout title',
  },
  saveUserNames: {
    id: 'app.actionsBar.actionsDropdown.saveUserNames',
    description: 'Save user name feature description',
  },
  captionsLabel: {
    id: 'app.actionsBar.actionsDropdown.captionsLabel',
    description: 'Captions menu toggle label',
  },
  captionsDesc: {
    id: 'app.actionsBar.actionsDropdown.captionsDesc',
    description: 'Captions menu toggle description',
  },
  savedNamesListTitle: {
    id: 'app.userList.userOptions.savedNames.title',
    description: '',
  },
  sortedFirstNameHeading: {
    id: 'app.userList.userOptions.sortedFirstName.heading',
    description: '',
  },
  sortedLastNameHeading: {
    id: 'app.userList.userOptions.sortedLastName.heading',
    description: '',
  },
});

class UserOptions extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      isUserOptionsOpen: false,
    };

    this.clearStatusId = _.uniqueId('list-item-');
    this.muteId = _.uniqueId('list-item-');
    this.muteAllId = _.uniqueId('list-item-');
    this.lockId = _.uniqueId('list-item-');
    this.guestPolicyId = _.uniqueId('list-item-');
    this.createBreakoutId = _.uniqueId('list-item-');
    this.saveUsersNameId = _.uniqueId('list-item-');
    this.captionsId = _.uniqueId('list-item-');

    this.onActionsShow = this.onActionsShow.bind(this);
    this.onActionsHide = this.onActionsHide.bind(this);
    this.handleCreateBreakoutRoomClick = this.handleCreateBreakoutRoomClick.bind(this);
    this.handleCaptionsClick = this.handleCaptionsClick.bind(this);
    this.onCreateBreakouts = this.onCreateBreakouts.bind(this);
    this.onInvitationUsers = this.onInvitationUsers.bind(this);
    this.renderMenuItems = this.renderMenuItems.bind(this);
    this.onSaveUserNames = this.onSaveUserNames.bind(this);
  }

  onSaveUserNames() {
    const { intl, meetingName } = this.props;
    const lang = Settings.application.locale;
    const date = new Date();

    const dateString = lang ? date.toLocaleDateString(lang) : date.toLocaleDateString();
    const timeString = lang ? date.toLocaleTimeString(lang) : date.toLocaleTimeString();

    getUserNamesLink(
      intl.formatMessage(intlMessages.savedNamesListTitle,
        {
          0: meetingName,
          1: `${dateString}:${timeString}`,
        }),
      intl.formatMessage(intlMessages.sortedFirstNameHeading),
      intl.formatMessage(intlMessages.sortedLastNameHeading),
    ).dispatchEvent(new MouseEvent('click',
      { bubbles: true, cancelable: true, view: window }));
  }

  onActionsShow() {
    this.setState({
      isUserOptionsOpen: true,
    });
  }

  onActionsHide() {
    this.setState({
      isUserOptionsOpen: false,
    });
  }

  onCreateBreakouts() {
    return this.handleCreateBreakoutRoomClick(false);
  }

  onInvitationUsers() {
    return this.handleCreateBreakoutRoomClick(true);
  }

  handleCreateBreakoutRoomClick(isInvitation) {
    const {
      mountModal,
      isBreakoutRecordable,
    } = this.props;

    return mountModal(
      <BreakoutRoom
        {...{
          isBreakoutRecordable,
          isInvitation,
        }}
      />,
    );
  }

  handleCaptionsClick() {
    const { mountModal } = this.props;
    mountModal(<CaptionsWriterMenu />);
  }

  renderMenuItems() {
    const {
      intl,
      isMeetingMuted,
      mountModal,
      toggleStatus,
      toggleMuteAllUsers,
      toggleMuteAllUsersExceptPresenter,
      meetingIsBreakout,
      hasBreakoutRoom,
      isBreakoutEnabled,
      getUsersNotAssigned,
      amIModerator,
      users,
      isMeteorConnected,
      dynamicGuestPolicy,
    } = this.props;

    const canCreateBreakout = amIModerator
      && !meetingIsBreakout
      && !hasBreakoutRoom
      && isBreakoutEnabled;

    const canInviteUsers = amIModerator
      && !meetingIsBreakout
      && hasBreakoutRoom
      && getUsersNotAssigned(users).length;

    this.menuItems = _.compact([
      (isMeteorConnected ? (
        <Dropdown.DropdownListItem
          key={this.clearStatusId}
          icon="clear_status"
          label={intl.formatMessage(intlMessages.clearAllLabel)}
          description={intl.formatMessage(intlMessages.clearAllDesc)}
          onClick={toggleStatus}
        />
      ) : null
      ),
      (!meetingIsBreakout && isMeteorConnected ? (
        <Dropdown.DropdownListItem
          key={this.muteAllId}
          icon={isMeetingMuted ? 'unmute' : 'mute'}
          label={intl.formatMessage(intlMessages[isMeetingMuted ? 'unmuteAllLabel' : 'muteAllLabel'])}
          description={intl.formatMessage(intlMessages[isMeetingMuted ? 'unmuteAllDesc' : 'muteAllDesc'])}
          onClick={toggleMuteAllUsers}
        />
      ) : null
      ),
      (!meetingIsBreakout && !isMeetingMuted && isMeteorConnected ? (
        <Dropdown.DropdownListItem
          key={this.muteId}
          icon="mute"
          label={intl.formatMessage(intlMessages.muteAllExceptPresenterLabel)}
          description={intl.formatMessage(intlMessages.muteAllExceptPresenterDesc)}
          onClick={toggleMuteAllUsersExceptPresenter}
        />
      ) : null
      ),
      (amIModerator
        ? (
          <Dropdown.DropdownListItem
            icon="download"
            label={intl.formatMessage(intlMessages.saveUserNames)}
            key={this.saveUsersNameId}
            onClick={this.onSaveUserNames}
          />
        )
        : null
      ),
      (!meetingIsBreakout && isMeteorConnected ? (
        <Dropdown.DropdownListItem
          key={this.lockId}
          icon="lock"
          label={intl.formatMessage(intlMessages.lockViewersLabel)}
          description={intl.formatMessage(intlMessages.lockViewersDesc)}
          onClick={() => mountModal(<LockViewersContainer />)}
        />
      ) : null
      ),
      (!meetingIsBreakout && isMeteorConnected && dynamicGuestPolicy ? (
        <Dropdown.DropdownListItem
          key={this.guestPolicyId}
          icon="user"
          label={intl.formatMessage(intlMessages.guestPolicyLabel)}
          data-test="guestPolicyLabel"
          description={intl.formatMessage(intlMessages.guestPolicyDesc)}
          onClick={() => mountModal(<GuestPolicyContainer />)}
        />
      ) : null
      ),
      (isMeteorConnected ? <Dropdown.DropdownListSeparator key={_.uniqueId('list-separator-')} /> : null),
      (canCreateBreakout && isMeteorConnected ? (
        <Dropdown.DropdownListItem
          data-test="createBreakoutRooms"
          key={this.createBreakoutId}
          icon="rooms"
          label={intl.formatMessage(intlMessages.createBreakoutRoom)}
          description={intl.formatMessage(intlMessages.createBreakoutRoomDesc)}
          onClick={this.onCreateBreakouts}
        />
      ) : null
      ),
      (canInviteUsers && isMeteorConnected ? (
        <Dropdown.DropdownListItem
          data-test="inviteBreakoutRooms"
          icon="rooms"
          label={intl.formatMessage(intlMessages.invitationItem)}
          key={this.createBreakoutId}
          onClick={this.onInvitationUsers}
        />
      ) : null
      ),
      (amIModerator && CaptionsService.isCaptionsEnabled() && isMeteorConnected
        ? (
          <Dropdown.DropdownListItem
            icon="closed_caption"
            label={intl.formatMessage(intlMessages.captionsLabel)}
            description={intl.formatMessage(intlMessages.captionsDesc)}
            key={this.captionsId}
            onClick={this.handleCaptionsClick}
          />
        )
        : null),
    ]);

    return this.menuItems;
  }

  render() {
    const { isUserOptionsOpen } = this.state;
    const { intl } = this.props;

    return (
      <Dropdown
        ref={(ref) => { this.dropdown = ref; }}
        autoFocus={false}
        isOpen={isUserOptionsOpen}
        onShow={this.onActionsShow}
        onHide={this.onActionsHide}
        className={styles.dropdown}
      >
        <Dropdown.DropdownTrigger tabIndex={0}>
          <Button
            label={intl.formatMessage(intlMessages.optionsLabel)}
            data-test="manageUsers"
            icon="settings"
            ghost
            color="primary"
            hideLabel
            className={styles.optionsButton}
            size="sm"
            onClick={() => null}
          />
        </Dropdown.DropdownTrigger>
        <Dropdown.DropdownContent
          className={styles.dropdownContent}
          placement="right top"
        >
          <Dropdown.DropdownList>
            {
              this.renderMenuItems()
            }
          </Dropdown.DropdownList>
        </Dropdown.DropdownContent>
      </Dropdown>
    );
  }
}

UserOptions.propTypes = propTypes;
export default withModalMounter(injectIntl(UserOptions));
