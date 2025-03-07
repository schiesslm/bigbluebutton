import React, { Component } from 'react';
import injectWbResizeEvent from '/imports/ui/components/presentation/resize-wrapper/component';
import { defineMessages, injectIntl } from 'react-intl';
import ReactPlayer from 'react-player';
import { sendMessage, onMessage, removeAllListeners } from './service';
import logger from '/imports/startup/client/logger';
import Service from './service';

import VolumeSlider from './volume-slider/component';
import ReloadButton from '/imports/ui/components/reload-button/component';

import ArcPlayer from './custom-players/arc-player';
import PeerTubePlayer from './custom-players/peertube';

import { styles } from './styles';

const intlMessages = defineMessages({
  autoPlayWarning: {
    id: 'app.externalVideo.autoPlayWarning',
    description: 'Shown when user needs to interact with player to make it work',
  },
  refreshLabel: {
    id: 'app.externalVideo.refreshLabel',
  },
});

const SYNC_INTERVAL_SECONDS = 5;
const THROTTLE_INTERVAL_SECONDS = 0.5;
const AUTO_PLAY_BLOCK_DETECTION_TIMEOUT_SECONDS = 5;

ReactPlayer.addCustomPlayer(PeerTubePlayer);
ReactPlayer.addCustomPlayer(ArcPlayer);

class VideoPlayer extends Component {
  constructor(props) {
    super(props);

    const { isPresenter } = props;

    this.player = null;
    this.syncInterval = null;
    this.autoPlayTimeout = null;
    this.hasPlayedBefore = false;
    this.playerIsReady = false;

    this.lastMessage = null;
    this.lastMessageTimestamp = Date.now();

    this.throttleTimeout = null;

    this.state = {
      muted: false,
      playing: false,
      autoPlayBlocked: false,
      volume: 1,
      playbackRate: 1,
      key: 0,
    };

    this.opts = {
      // default option for all players, can be overwritten
      playerOptions: {
        autoplay: true,
        playsinline: true,
        controls: isPresenter,
      },
      file: {
        attributes: {
          controls: isPresenter ? 'controls' : '',
          autoplay: 'autoplay',
          playsinline: 'playsinline',
        },
      },
      dailymotion: {
        params: {
          controls: isPresenter,
        },
      },
      youtube: {
        playerVars: {
          autoplay: 1,
          modestbranding: 1,
          autohide: 1,
          rel: 0,
          ecver: 2,
          controls: isPresenter ? 1 : 0,
        },
      },
      peertube: {
        isPresenter,
      },
      twitch: {
        options: {
          controls: isPresenter,
        },
        playerId: 'externalVideoPlayerTwitch',
      },
      preload: true,
    };

    this.registerVideoListeners = this.registerVideoListeners.bind(this);
    this.autoPlayBlockDetected = this.autoPlayBlockDetected.bind(this);
    this.clearVideoListeners = this.clearVideoListeners.bind(this);
    this.handleFirstPlay = this.handleFirstPlay.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleReload = this.handleReload.bind(this);
    this.handleOnProgress = this.handleOnProgress.bind(this);
    this.handleOnReady = this.handleOnReady.bind(this);
    this.handleOnPlay = this.handleOnPlay.bind(this);
    this.handleOnPause = this.handleOnPause.bind(this);
    this.handleVolumeChanged = this.handleVolumeChanged.bind(this);
    this.handleOnMuted = this.handleOnMuted.bind(this);
    this.sendSyncMessage = this.sendSyncMessage.bind(this);
    this.getCurrentPlaybackRate = this.getCurrentPlaybackRate.bind(this);
    this.getCurrentTime = this.getCurrentTime.bind(this);
    this.getCurrentVolume = this.getCurrentVolume.bind(this);
    this.getMuted = this.getMuted.bind(this);
    this.setPlaybackRate = this.setPlaybackRate.bind(this);
    this.resizeListener = () => {
      setTimeout(this.handleResize, 0);
    };
    this.onBeforeUnload = this.onBeforeUnload.bind(this);
  }

  componentDidMount() {
    window.addEventListener('resize', this.resizeListener);
    window.addEventListener('layoutSizesSets', this.resizeListener);
    window.addEventListener('beforeunload', this.onBeforeUnload);

    clearInterval(this.syncInterval);
    clearTimeout(this.autoPlayTimeout);

    this.clearVideoListeners();
    this.registerVideoListeners();
  }

  onBeforeUnload() {
    const { isPresenter } = this.props;

    if (isPresenter) {
      this.sendSyncMessage('stop');
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeListener);
    window.removeEventListener('beforeunload', this.onBeforeUnload);

    this.clearVideoListeners();

    clearInterval(this.syncInterval);
    clearTimeout(this.autoPlayTimeout);

    this.player = null;
  }

  componentDidUpdate(prevProp, prevState) {
    // Detect presenter change and redo the sync and listeners to reassign video to the new one
    if (this.props.isPresenter !== prevProp.isPresenter) {
      this.clearVideoListeners();

      clearInterval(this.syncInterval);
      clearTimeout(this.autoPlayTimeout);

      this.registerVideoListeners();
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    const { isPresenter } = this.props;
    const { playing } = this.state;

    // If user is presenter we don't re-render playing state changes
    // Because he's in control of the play/pause status
    if (nextProps.isPresenter && isPresenter && nextState.playing !== playing) {
      return false;
    }

    return true;
  }

  static getDerivedStateFromProps(props) {
    const { inEchoTest } = props;

    return { mutedByEchoTest: inEchoTest };
  }

  sendSyncMessage(msg, params) {
    const timestamp = Date.now();

    // If message is just a quick pause/un-pause just send nothing
    const sinceLastMessage = (timestamp - this.lastMessageTimestamp) / 1000;
    if ((msg === 'play' && this.lastMessage === 'stop'
         || msg === 'stop' && this.lastMessage === 'play')
         && sinceLastMessage < THROTTLE_INTERVAL_SECONDS) {
      return clearTimeout(this.throttleTimeout);
    }

    // Ignore repeat presenter ready messages
    if (this.lastMessage === msg && msg === 'presenterReady') {
      logger.debug('Ignoring a repeated presenterReady message');
    } else {
      // Play/pause messages are sent with a delay, to permit cancelling it in case of
      // quick sucessive play/pauses
      const messageDelay = (msg === 'play' || msg === 'stop') ? THROTTLE_INTERVAL_SECONDS : 0;

      this.throttleTimeout = setTimeout(() => {
        sendMessage(msg, { ...params });
      }, messageDelay * 1000);

      this.lastMessage = msg;
      this.lastMessageTimestamp = timestamp;
    }
  }

  autoPlayBlockDetected() {
    this.setState({ autoPlayBlocked: true });
  }

  handleFirstPlay() {
    const { isPresenter } = this.props;
    const { hasPlayedBefore } = this;

    if (!hasPlayedBefore) {
      this.hasPlayedBefore = true;
      this.setState({ autoPlayBlocked: false });

      clearTimeout(this.autoPlayTimeout);

      if (isPresenter) {
        this.sendSyncMessage('presenterReady');
      }
    }
  }

  getCurrentTime() {
    if (this.player && this.player.getCurrentTime) {
      return Math.round(this.player.getCurrentTime());
    }
  }

  getCurrentPlaybackRate() {
    const intPlayer = this.player && this.player.getInternalPlayer();

    return (intPlayer && intPlayer.getPlaybackRate && intPlayer.getPlaybackRate()) || 1;
  }

  setPlaybackRate(rate) {
    const intPlayer = this.player && this.player.getInternalPlayer();
    const currentRate = this.getCurrentPlaybackRate();

    if (currentRate === rate) {
      return;
    }

    this.setState({ playbackRate: rate });
    if (intPlayer && intPlayer.setPlaybackRate) {
      intPlayer.setPlaybackRate(rate);
    }
  }

  handleResize() {
    const { top, left, height, width, layoutLoaded } = this.props;

    if (!this.player || !this.playerParent) {
      return;
    }

    if (layoutLoaded === 'new') {
      const idealW = height * 16 / 9;

      const style = {};
      if (idealW > width) {
        style.width = width;
        style.height = width * 9 / 16;
      } else {
        style.width = idealW;
        style.height = height;
      }
      style.top = top + (height - style.height) / 2;
      style.left = left + (width - style.width) / 2;

      const styles = `
        position: absolute;
        width: ${style.width}px;
        height: ${style.height}px;
        top: ${style.top}px;
        left: ${style.left}px;
      `;
      this.player.wrapper.style = styles;
    }else{
      const par = this.playerParent.parentElement;
      const w = par.clientWidth;
      const h = par.clientHeight;
      const idealW = h * 16 / 9;

      const style = {};
      if (idealW > w) {
        style.width = w;
        style.height = w * 9 / 16;
      } else {
        style.width = idealW;
        style.height = h;
      }

      const styles = `width: ${style.width}px; height: ${style.height}px;`;

      this.player.wrapper.style = styles;
      this.playerParent.style = styles;
    }
  }

  clearVideoListeners() {
    removeAllListeners('play');
    removeAllListeners('stop');
    removeAllListeners('playerUpdate');
    removeAllListeners('presenterReady');
  }

  registerVideoListeners() {
    const { isPresenter } = this.props;

    if (isPresenter) {
      this.syncInterval = setInterval(() => {
        const { playing } = this.state;
        const curTime = this.getCurrentTime();
        const rate = this.getCurrentPlaybackRate();

        // Always pause video if presenter is has not started sharing, e.g., blocked by autoplay
        const playingState = this.hasPlayedBefore ? playing : false;

        this.sendSyncMessage('playerUpdate', { rate, time: curTime, state: playingState });
      }, SYNC_INTERVAL_SECONDS * 1000);
    } else {
      onMessage('play', ({ time }) => {
        const { hasPlayedBefore, player } = this;

        if (!player || !hasPlayedBefore) {
          return;
        }
        this.seekTo(time);
        this.setState({ playing: true });

        logger.debug({ logCode: 'external_video_client_play' }, 'Play external video');
      });

      onMessage('stop', ({ time }) => {
        const { hasPlayedBefore, player } = this;

        if (!player || !hasPlayedBefore) {
          return;
        }
        this.seekTo(time);
        this.setState({ playing: false });

        logger.debug({ logCode: 'external_video_client_stop' }, 'Stop external video');
      });

      onMessage('presenterReady', (data) => {
        const { hasPlayedBefore } = this;

        logger.debug({ logCode: 'external_video_presenter_ready' }, 'Presenter is ready to sync');

        if (!hasPlayedBefore) {
          this.setState({ playing: true });
        }
      });

      onMessage('playerUpdate', (data) => {
        const { hasPlayedBefore, player } = this;
        const { playing } = this.state;
        const { time, rate, state } = data;

        if (!player || !hasPlayedBefore) {
          return;
        }

        if (rate !== this.getCurrentPlaybackRate()) {
          this.setPlaybackRate(rate);
          logger.debug({
            logCode: 'external_video_client_update_rate',
            extraInfo: {
              newRate: rate,
            },
          }, 'Change external video playback rate.');
        }

        this.seekTo(time);

        const playingState = Service.getPlayingState(state);
        if (playing !== playingState) {
          this.setState({ playing: playingState });
        }
      });
    }
  }

  seekTo(time) {
    const { player } = this;

    if (!player) {
      return logger.error('No player on seek');
    }

    // Seek if viewer has drifted too far away from presenter
    if (Math.abs(this.getCurrentTime() - time) > SYNC_INTERVAL_SECONDS * 0.75) {
      player.seekTo(time, true);
      logger.debug({
        logCode: 'external_video_client_update_seek',
        extraInfo: { time },
      }, `Seek external video to: ${time}`);
    }
  }

  handleOnReady() {
    const { hasPlayedBefore, playerIsReady } = this;

    if (hasPlayedBefore || playerIsReady) {
      return;
    }

    this.playerIsReady = true;

    this.handleResize();

    this.autoPlayTimeout = setTimeout(this.autoPlayBlockDetected, AUTO_PLAY_BLOCK_DETECTION_TIMEOUT_SECONDS * 1000);
  }

  handleOnPlay() {
    const { isPresenter } = this.props;
    const { playing } = this.state;

    const curTime = this.getCurrentTime();

    if (isPresenter && !playing) {
      this.sendSyncMessage('play', { time: curTime });
    }
    this.setState({ playing: true });

    this.handleFirstPlay();

    if (!isPresenter && !playing) {
      this.setState({ playing: false });
    }
  }

  handleOnPause() {
    const { isPresenter } = this.props;
    const { playing } = this.state;

    const curTime = this.getCurrentTime();

    if (isPresenter && playing) {
      this.sendSyncMessage('stop', { time: curTime });
    }
    this.setState({ playing: false });

    this.handleFirstPlay();

    if (!isPresenter && playing) {
      this.setState({ playing: true });
    }
  }

  handleOnProgress() {
    const volume = this.getCurrentVolume();
    const muted = this.getMuted();

    this.setState({ volume, muted });
  }

  getMuted() {
    const intPlayer = this.player && this.player.getInternalPlayer();

    return (intPlayer && intPlayer.isMuted && intPlayer.isMuted()) || this.state.muted;
  }

  getCurrentVolume() {
    const intPlayer = this.player && this.player.getInternalPlayer();

    return (intPlayer && intPlayer.getVolume && intPlayer.getVolume() / 100.0) || this.state.volume;
  }

  handleVolumeChanged(volume) {
    this.setState({ volume });
  }

  handleOnMuted(muted) {
    this.setState({ muted });
  }

  handleReload() {
    // increment key and force a re-render of the video component
    this.setState({key: this.state.key + 1});

    // hack, resize player
    this.resizeListener();
  }

  render() {
    const { videoUrl, isPresenter, intl } = this.props;
    const {
      playing, playbackRate, mutedByEchoTest, autoPlayBlocked,
      volume, muted, key,
    } = this.state;

    return (
      <div
        id="video-player"
        data-test="videoPlayer"
        className={styles.videoPlayerWrapper}
        ref={(ref) => { this.playerParent = ref; }}
      >
        {autoPlayBlocked
          ? (
            <p className={styles.autoPlayWarning}>
              {intl.formatMessage(intlMessages.autoPlayWarning)}
            </p>
          )
          : ''
        }
        <ReactPlayer
          className={styles.videoPlayer}
          url={videoUrl}
          config={this.opts}
          volume={(muted || mutedByEchoTest) ? 0 : volume}
          muted={muted || mutedByEchoTest}
          playing={playing}
          playbackRate={playbackRate}
          onProgress={this.handleOnProgress}
          onReady={this.handleOnReady}
          onPlay={this.handleOnPlay}
          onPause={this.handleOnPause}
          key={'react-player' + key}
          ref={(ref) => { this.player = ref; }}
        />
        { !isPresenter ?
            <div className={styles.hoverToolbar}>
              <VolumeSlider
                volume={volume}
                muted={muted || mutedByEchoTest}
                onMuted={this.handleOnMuted}
                onVolumeChanged={this.handleVolumeChanged}
              />
              <ReloadButton
                handleReload={this.handleReload}
                label={intl.formatMessage(intlMessages.refreshLabel)}>
              </ReloadButton>
            </div>
          : null
        }
      </div>
    );
  }
}

export default injectIntl(injectWbResizeEvent(VideoPlayer));
