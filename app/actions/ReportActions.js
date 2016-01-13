"use strict";

var _ = require("lodash");
var abi = require("augur-abi");
var augur = require("augur.js");
var secureRandom = require("secure-random");
var constants = require("../libs/constants");

var bytesToHex = function (bytes) {
  return '0x' + _.reduce(bytes, function (hexString, byte) {
    return hexString + byte.toString(16);
  }, '');
};

module.exports = {

  /**
   * Load the events in the current branch that need reports.
   *
   * TODO: Load events across all branches that need reports.
   */
  loadEventsToReport: function () {
    var self = this;
    var branch = this.flux.store('branch').getState().currentBranch;

    // Only load events if the vote period indicated by the chain is the
    // previous period. (Otherwise, dispatch needs to be run, which will
    // move the events from their old periods to the current period. Those
    // events will get voted on in the next period.)
    if (branch && branch.votePeriod === branch.currentPeriod - 1) {
      augur.getEvents(branch.id, branch.votePeriod, function (eventIds) {
        if (!eventIds || eventIds.error) {
          return self.dispatch(constants.report.LOAD_EVENTS_TO_REPORT_SUCCESS, {
            eventsToReport: {}
          });
        }
        eventIds = abi.bignum(eventIds);

        // initialize all events
        var eventsToReport = {};
        _.each(eventIds, function (id) { eventsToReport[id] = { id: id }; });
        self.dispatch(constants.report.LOAD_EVENTS_TO_REPORT_SUCCESS, {
          eventsToReport: eventsToReport
        });

        _.each(eventIds, function (eventId) {
          var eventToReport = { id: eventId };
          augur.getDescription(eventId, function (description) {
            if (description && !description.error) {
              eventToReport['description'] = description;
            }
            augur.getEventInfo(eventId, function (eventInfo) {
              if (eventInfo && !eventInfo.error) {
                eventToReport['branchId'] = eventInfo[0];
                eventToReport['expirationBlock'] = abi.bignum(eventInfo[1]);
                eventToReport['outcome'] = abi.bignum(eventInfo[2]);
                eventToReport['minValue'] = abi.bignum(eventInfo[3]);
                eventToReport['maxValue'] = abi.bignum(eventInfo[4]);
                eventToReport['numOutcomes'] = abi.bignum(eventInfo[5]);
              }
              self.dispatch(
                constants.report.UPDATE_EVENT_TO_REPORT,
                eventToReport
              );
            });
          });
        }, self);
      });

    } else {

      this.dispatch(constants.report.LOAD_EVENTS_TO_REPORT_SUCCESS, {
        eventsToReport: {}
      });
    }
  },

  storeReports: function (reports) {
    // TODO: Encrypt the reports so malware can't access them and steal
    // reputation.
    localStorage.setItem(constants.report.REPORTS_STORAGE, JSON.stringify(reports));
  },

  /**
   * Broadcast the hash of the report and store the report and salt.
   */
  hashReport: function (branchId, votePeriod, decisions) {
    var saltBytes = secureRandom(32);
    var salt = bytesToHex(saltBytes);

    var pendingReports = this.flux.store('report').getState().pendingReports;
    pendingReports.push({
      branchId,
      votePeriod,
      decisions,
      salt,
      reported: false
    });
    this.flux.actions.report.storeReports(pendingReports);

    // Hash the report and submit it to the network.
    var reportHash = augur.hashReport(decisions, salt);
    console.log("Submitting hash for period", votePeriod);
    console.log("Report hash:", reportHash);
    augur.submitReportHash({
      branchId: branchId,
      reportHash: reportHash,
      votePeriod: votePeriod,
      onSent: function (res) {
        console.log("submitReportHash sent:", res);
      },
      onSuccess: function (res) {
        console.log("submitReportHash success:", res);
      },
      onFailed: function (err) {
        console.error("submitReportHash failed:", err);
      }
    });

    this.dispatch(constants.report.UPDATE_PENDING_REPORTS, {pendingReports});
  },

  /**
   * Submit the actual report data.
   *
   * @param report {Object} branchId, votePeriod, decisions and salt.
   */
  submitReport: function (report) {
    console.log("submit report:", report);
    augur.report({
      branchId: report.branchId,
      decisions: report.decisions,
      votePeriod: report.votePeriod,
      salt: report.salt,
      onSent: function (res) {
        // sent
        console.log("submitReport sent:", res);
      },
      onSuccess: function (res) {
        // success
        console.log("submitReport success:", res);
      },
      onFailed: function (err) {
        // failed
        console.error("submitReport failed:", err);
      }
    });
  },

  /**
   * Submit any reports that haven't been submitted and are in the last half of
   * their reporting period.
   */
  submitQualifiedReports: function () {
    var currentBlock = this.flux.store('network').getState().blockNumber;
    var reports = this.flux.store('report').getState().pendingReports;
    var unsentReports = _.filter(reports, function (r) { return !r.reported; });
    var didSendReports = false;

    _.forEach(unsentReports, function (report) {
      if (report && report.branchId && report.votePeriod) {
        augur.getPeriodLength(report.branchId, function (periodLength) {
          periodLength = abi.number(periodLength);

          var reportingStartBlock = (report.votePeriod + 1) * periodLength;
          var reportingCurrentBlock = currentBlock - reportingStartBlock;
          var shouldSend = reportingCurrentBlock > (periodLength / 2);

          if (shouldSend) {
            console.log('Sending report for period', report.votePeriod);
            this.flux.actions.report.submitReport(report);
            report.reported = true;
            didSendReports = true;
          }
        });
      }
    });

    if (didSendReports) {
      // Update localStorage and the stores with the mutated reports array.
      this.flux.actions.report.storeReports(reports);
      this.dispatch(constants.report.LOAD_PENDING_REPORTS_SUCCESS, {pendingReports: reports});
    }
  },

  loadPendingReports: function () {
    var reportsString = localStorage.getItem(constants.report.REPORTS_STORAGE);
    var pendingReports = reportsString ? JSON.parse(reportsString) : [];
    this.dispatch(constants.report.LOAD_PENDING_REPORTS_SUCCESS, {pendingReports});
  }
};
