import React, { useState, useEffect } from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import PropTypes from 'prop-types';
import { styles } from './styles';
import Button from '/imports/ui/components/button/component';
import {
  EFFECT_TYPES,
  BLUR_FILENAME,
  IMAGE_NAMES,
  getVirtualBackgroundThumbnail,
  getSessionVirtualBackgroundInfo,
} from '/imports/ui/services/virtual-background/service'

const propTypes = {
  intl: PropTypes.shape({
    formatMessage: PropTypes.func.isRequired,
  }).isRequired,
  handleVirtualBgSelected: PropTypes.func.isRequired,
  locked: PropTypes.bool.isRequired,
  showThumbnails: PropTypes.bool,
  initialVirtualBgState: PropTypes.shape({
    type: PropTypes.string.isRequired,
    name: PropTypes.string,
  }),
};

const intlMessages = defineMessages({
  virtualBackgroundSettingsLabel: {
    id: 'app.videoPreview.webcamVirtualBackgroundLabel',
    description: 'Label for the virtual background',
  },
  noneLabel: {
    id: 'app.video.virtualBackground.none',
    description: 'Label for no virtual background selected',
  },
  blurLabel: {
    id: 'app.video.virtualBackground.blur',
    description: 'Label for the blurred camera option',
  }
});

const VirtualBgSelector = ({
  intl,
  handleVirtualBgSelected,
  locked,
  showThumbnails,
  initialVirtualBgState,
}) => {
  const [currentVirtualBg, setCurrentVirtualBg] = useState({
    ...initialVirtualBgState,
  });

  const _virtualBgSelected = (type, name) => {
    handleVirtualBgSelected(type, name).then(switched => {
      // Reset to the base NONE_TYPE effect if it failed because the expected
      // behaviour from upstream's method is to actually stop/reset the effect
      // service if it fails
      if (!switched) {
        return setCurrentVirtualBg({ type: EFFECT_TYPES.NONE_TYPE });
      }

      setCurrentVirtualBg({ type, name });
    });
  };

  const renderDropdownSelector = () => {
    return (
      <div className={styles.virtualBackgroundRow}>
        <select
          value={JSON.stringify(currentVirtualBg)}
          className={styles.select}
          disabled={locked}
          onChange={event => {
            const { type, name } = JSON.parse(event.target.value);
            _virtualBgSelected(type, name);
          }}
        >
          <option value={JSON.stringify({ type: EFFECT_TYPES.NONE_TYPE })}>
            {intl.formatMessage(intlMessages.noneLabel)}
          </option>

          <option value={JSON.stringify({ type: EFFECT_TYPES.BLUR_TYPE })}>
            {intl.formatMessage(intlMessages.blurLabel)}
          </option>

          {IMAGE_NAMES.map((imageName, index) => (
            <option key={`${imageName}-${index}`} value={JSON.stringify({
              type: EFFECT_TYPES.IMAGE_TYPE,
              name: imageName,
            })}>
            {imageName.split(".")[0]}
          </option>
          ))}
        </select>
      </div>
    );
  }

  const renderThumbnailSelector = () => {
    return (
      <div className={styles.virtualBackgroundRow}>
        <Button
          icon='close'
          label={intl.formatMessage(intlMessages.noneLabel)}
          hideLabel
          disabled={locked}
          onClick={() => _virtualBgSelected(EFFECT_TYPES.NONE_TYPE)}
        />

      <input
        type="image"
        aria-label={EFFECT_TYPES.BLUR_TYPE}
        src={getVirtualBackgroundThumbnail(BLUR_FILENAME)}
        disabled={locked}
        onClick={() => _virtualBgSelected(EFFECT_TYPES.BLUR_TYPE)}
      />

    {IMAGE_NAMES.map((imageName, index) => (
      <input
        type="image"
        aria-label={imageName}
        key={`${imageName}-${index}`}
        src={getVirtualBackgroundThumbnail(imageName)}
        onClick={() => _virtualBgSelected(EFFECT_TYPES.IMAGE_TYPE, imageName)}
        disabled={locked}
      />
    ))}
  </div>
    );
  };

  const renderSelector = () => {
    if (showThumbnails) return renderThumbnailSelector();
    return renderDropdownSelector();
  };

  return (
    <div>
      <label className={styles.label}>
        {intl.formatMessage(intlMessages.virtualBackgroundSettingsLabel)}
      </label>

      {renderSelector()}
    </div>
  );
};

VirtualBgSelector.propTypes = propTypes;
VirtualBgSelector.defaultProps = {
  showThumbnails: false,
  initialVirtualBgState: {
    type: EFFECT_TYPES.NONE_TYPE,
  }
};

export default injectIntl(VirtualBgSelector);
