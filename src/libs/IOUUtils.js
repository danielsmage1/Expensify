import _ from 'underscore';
import CONST from '../CONST';
import * as ReportActionsUtils from './ReportActionsUtils';
import * as CurrencyUtils from './CurrencyUtils';

/**
 * Calculates the amount per user given a list of participants
 *
 * @param {Number} numberOfParticipants - Number of participants in the chat. It should not include the current user.
 * @param {Number} total - IOU total amount in backend format (cents, no matter the currency)
 * @param {String} currency - This is used to know how many decimal places are valid to use when splitting the total
 * @param {Boolean} isDefaultUser - Whether we are calculating the amount for the current user
 * @returns {Number}
 */
function calculateAmount(numberOfParticipants, total, currency, isDefaultUser = false) {
    // Since the backend can maximum store 2 decimal places, any currency with more than 2 decimals
    // has to be capped to 2 decimal places
    const currencyUnit = Math.min(100, CurrencyUtils.getCurrencyUnit(currency));
    const totalInCurrencySubunit = Math.round((total / 100) * currencyUnit);
    const totalParticipants = numberOfParticipants + 1;
    const amountPerPerson = Math.round(totalInCurrencySubunit / totalParticipants);
    let finalAmount = amountPerPerson;
    if (isDefaultUser) {
        const sumAmount = amountPerPerson * totalParticipants;
        const difference = totalInCurrencySubunit - sumAmount;
        finalAmount = totalInCurrencySubunit !== sumAmount ? amountPerPerson + difference : amountPerPerson;
    }
    return Math.round((finalAmount * 100) / currencyUnit);
}

/**
 * The owner of the IOU report is the account who is owed money and the manager is the one who owes money!
 * In case the owner/manager swap, we need to update the owner of the IOU report and the report total, since it is always positive.
 * For example: if user1 owes user2 $10, then we have: {ownerAccountID: user2, managerID: user1, total: $10 (a positive amount, owed to user2)}
 * If user1 requests $17 from user2, then we have: {ownerAccountID: user1, managerID: user2, total: $7 (still a positive amount, but now owed to user1)}
 *
 * @param {Object} iouReport
 * @param {Number} actorAccountID
 * @param {Number} amount
 * @param {String} currency
 * @param {String} isDeleting - whether the user is deleting the request
 * @returns {Object}
 */
function updateIOUOwnerAndTotal(iouReport, actorAccountID, amount, currency, isDeleting = false) {
    if (currency !== iouReport.currency) {
        return iouReport;
    }

    // Make a copy so we don't mutate the original object
    const iouReportUpdate = {...iouReport};

    if (actorAccountID === iouReport.ownerAccountID) {
        iouReportUpdate.total += isDeleting ? -amount : amount;
    } else {
        iouReportUpdate.total += isDeleting ? amount : -amount;
    }

    if (iouReportUpdate.total < 0) {
        // The total sign has changed and hence we need to flip the manager and owner of the report.
        iouReportUpdate.ownerAccountID = iouReport.managerID;
        iouReportUpdate.managerID = iouReport.ownerAccountID;
        iouReportUpdate.total = -iouReportUpdate.total;
    }

    iouReportUpdate.hasOutstandingIOU = iouReportUpdate.total !== 0;

    return iouReportUpdate;
}

/**
 * Returns the list of IOU actions depending on the type and whether or not they are pending.
 * Used below so that we can decide if an IOU report is pending currency conversion.
 *
 * @param {Array} reportActions
 * @param {Object} iouReport
 * @param {String} type - iouReportAction type. Can be oneOf(create, delete, pay, split)
 * @param {String} pendingAction
 * @param {Boolean} filterRequestsInDifferentCurrency
 *
 * @returns {Array}
 */
function getIOUReportActions(reportActions, iouReport, type = '', pendingAction = '', filterRequestsInDifferentCurrency = false) {
    return _.chain(reportActions)
        .filter((action) => action.originalMessage && ReportActionsUtils.isMoneyRequestAction(action) && (!_.isEmpty(type) ? action.originalMessage.type === type : true))
        .filter((action) => action.originalMessage.IOUReportID.toString() === iouReport.reportID.toString())
        .filter((action) => (!_.isEmpty(pendingAction) ? action.pendingAction === pendingAction : true))
        .filter((action) => (filterRequestsInDifferentCurrency ? action.originalMessage.currency !== iouReport.currency : true))
        .value();
}

/**
 * Returns whether or not an IOU report contains money requests in a different currency
 * that are either created or cancelled offline, and thus haven't been converted to the report's currency yet
 *
 * @param {Array} reportActions
 * @param {Object} iouReport
 *
 * @returns {Boolean}
 */
function isIOUReportPendingCurrencyConversion(reportActions, iouReport) {
    // Pending money requests that are in a different currency
    const pendingRequestsInDifferentCurrency = _.chain(getIOUReportActions(reportActions, iouReport, CONST.IOU.REPORT_ACTION_TYPE.CREATE, CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD, true))
        .map((action) => action.originalMessage.IOUTransactionID)
        .sort()
        .value();

    // Pending deleted money requests that are in a different currency
    const pendingDeletedRequestsInDifferentCurrency = _.chain(
        getIOUReportActions(reportActions, iouReport, CONST.IOU.REPORT_ACTION_TYPE.DELETE, CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD, true),
    )
        .map((action) => action.originalMessage.IOUTransactionID)
        .sort()
        .value();

    const hasPendingRequests = Boolean(pendingRequestsInDifferentCurrency.length || pendingDeletedRequestsInDifferentCurrency.length);

    // If we have pending money requests made offline, check if all of them have been cancelled offline
    // In order to do that, we can grab transactionIDs of all the created and cancelled money requests and check if they're identical
    if (hasPendingRequests && _.isEqual(pendingRequestsInDifferentCurrency, pendingDeletedRequestsInDifferentCurrency)) {
        return false;
    }

    // Not all requests made offline had been cancelled,
    // simply return if we have any pending created or cancelled requests
    return hasPendingRequests;
}

/**
 * Checks if the iou type is one of request, send, or split.
 * @param {String} iouType
 * @returns {Boolean}
 */
function isValidMoneyRequestType(iouType) {
    return [CONST.IOU.MONEY_REQUEST_TYPE.REQUEST, CONST.IOU.MONEY_REQUEST_TYPE.SPLIT].includes(iouType);
}

export {calculateAmount, updateIOUOwnerAndTotal, getIOUReportActions, isIOUReportPendingCurrencyConversion, isValidMoneyRequestType};
