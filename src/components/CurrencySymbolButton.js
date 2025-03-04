import React from 'react';
import PropTypes from 'prop-types';
import Text from './Text';
import styles from '../styles/styles';
import Tooltip from './Tooltip';
import PressableWithoutFeedback from './Pressable/PressableWithoutFeedback';
import CONST from '../CONST';
import useLocalize from '../hooks/useLocalize';

const propTypes = {
    /** Currency symbol of selected currency */
    currencySymbol: PropTypes.string.isRequired,

    /** Function to call when currency button is pressed */
    onCurrencyButtonPress: PropTypes.func.isRequired,

    /** Flag to indicate if the button should be disabled */
    disabled: PropTypes.bool,
};

const defaultProps = {
    disabled: false,
};

function CurrencySymbolButton({onCurrencyButtonPress, currencySymbol, disabled}) {
    const {translate} = useLocalize();
    return (
        <Tooltip text={!disabled && translate('iOUCurrencySelection.selectCurrency')}>
            <PressableWithoutFeedback
                onPress={onCurrencyButtonPress}
                accessibilityLabel={!disabled && translate('iOUCurrencySelection.selectCurrency')}
                accessibilityRole={CONST.ACCESSIBILITY_ROLE.BUTTON}
                disabled={disabled}
            >
                <Text style={styles.iouAmountText}>{currencySymbol}</Text>
            </PressableWithoutFeedback>
        </Tooltip>
    );
}

CurrencySymbolButton.propTypes = propTypes;
CurrencySymbolButton.displayName = 'CurrencySymbolButton';
CurrencySymbolButton.defaultProps = defaultProps;

export default CurrencySymbolButton;
