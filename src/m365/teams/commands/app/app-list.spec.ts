import * as assert from 'assert';
import * as sinon from 'sinon';
import appInsights from '../../../../appInsights';
import auth from '../../../../Auth';
import { Cli } from '../../../../cli/Cli';
import { CommandInfo } from '../../../../cli/CommandInfo';
import { Logger } from '../../../../cli/Logger';
import Command, { CommandError } from '../../../../Command';
import request from '../../../../request';
import { pid } from '../../../../utils/pid';
import { sinonUtil } from '../../../../utils/sinonUtil';
import commands from '../../commands';
const command: Command = require('./app-list');

describe(commands.APP_LIST, () => {
  let log: string[];
  let logger: Logger;
  let loggerLogSpy: sinon.SinonSpy;
  let commandInfo: CommandInfo;

  before(() => {
    sinon.stub(auth, 'restoreAuth').callsFake(() => Promise.resolve());
    sinon.stub(appInsights, 'trackEvent').callsFake(() => { });
    sinon.stub(pid, 'getProcessName').callsFake(() => '');
    auth.service.connected = true;
    commandInfo = Cli.getCommandInfo(command);
  });

  beforeEach(() => {
    log = [];
    logger = {
      log: (msg: string) => {
        log.push(msg);
      },
      logRaw: (msg: string) => {
        log.push(msg);
      },
      logToStderr: (msg: string) => {
        log.push(msg);
      }
    };
    loggerLogSpy = sinon.spy(logger, 'log');
    (command as any).items = [];
  });

  afterEach(() => {
    sinonUtil.restore([
      request.get
    ]);
  });

  after(() => {
    sinonUtil.restore([
      auth.restoreAuth,
      appInsights.trackEvent,
      pid.getProcessName
    ]);
    auth.service.connected = false;
  });

  it('has correct name', () => {
    assert.strictEqual(command.name.startsWith(commands.APP_LIST), true);
  });

  it('has a description', () => {
    assert.notStrictEqual(command.description, null);
  });

  it('defines correct properties for the default output', () => {
    assert.deepStrictEqual(command.defaultProperties(), ['id', 'displayName', 'distributionMethod']);
  });

  it('fails validation if both teamId and teamName options are passed', async () => {
    const actual = await command.validate({
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        teamName: 'Team Name'
      }
    }, commandInfo);
    assert.notStrictEqual(actual, true);
  });

  it('lists Microsoft Teams apps in the organization app catalog', async () => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps?$filter=distributionMethod eq 'organization'`) {
        return Promise.resolve({
          "value": [
            {
              "id": "7131a36d-bb5f-46b8-bb40-0b199a3fad74",
              "externalId": "4f0cd7c8-995e-4868-812d-d1d402a81eca",
              "displayName": "WsInfo",
              "distributionMethod": "organization"
            }
          ]
        });
      }

      return Promise.reject('Invalid request');
    });

    await command.action(logger, { options: { debug: false } });
    assert(loggerLogSpy.calledWith([
      {
        "id": "7131a36d-bb5f-46b8-bb40-0b199a3fad74",
        "externalId": "4f0cd7c8-995e-4868-812d-d1d402a81eca",
        "displayName": "WsInfo",
        "distributionMethod": "organization"
      }
    ]));
  });

  it('fails when team name does not exist', async () => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/v1.0/groups?$filter=displayName eq '`) > -1) {
        return Promise.resolve({
          "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#teams",
          "@odata.count": 1,
          "value": [
            {
              "id": "00000000-0000-0000-0000-000000000000",
              "createdDateTime": null,
              "displayName": "Team Name",
              "description": "Team Description",
              "internalId": null,
              "classification": null,
              "specialization": null,
              "visibility": null,
              "webUrl": null,
              "isArchived": false,
              "isMembershipLimitedToOwners": null,
              "memberSettings": null,
              "guestSettings": null,
              "messagingSettings": null,
              "funSettings": null,
              "discoverySettings": null,
              "resourceProvisioningOptions": []
            }
          ]
        }
        );
      }
      return Promise.reject('Invalid request');
    });

    await assert.rejects(command.action(logger, { options: { 
      debug: true,
      teamName: 'Team Name' } } as any), new CommandError('The specified team does not exist in the Microsoft Teams'));
  });

  it('lists Microsoft Teams apps in the organization app catalog and Microsoft Teams store', async () => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps`) {
        return Promise.resolve({
          "value": [
            {
              "id": "012be6ac-6f34-4ffa-9344-b857f7bc74e1",
              "externalId": null,
              "displayName": "Pickit Images",
              "distributionMethod": "store"
            },
            {
              "id": "01b22ab6-c657-491c-97a0-d745bea11269",
              "externalId": null,
              "displayName": "Hootsuite",
              "distributionMethod": "store"
            },
            {
              "id": "02d14659-a28b-4007-8544-b279c0d3628b",
              "externalId": null,
              "displayName": "Pivotal Tracker",
              "distributionMethod": "store"
            }
          ]
        });
      }

      return Promise.reject('Invalid request');
    });

    await command.action(logger, { options: { all: true, debug: true } });
    assert(loggerLogSpy.calledWith([
      {
        "id": "012be6ac-6f34-4ffa-9344-b857f7bc74e1",
        "externalId": null,
        "displayName": "Pickit Images",
        "distributionMethod": "store"
      },
      {
        "id": "01b22ab6-c657-491c-97a0-d745bea11269",
        "externalId": null,
        "displayName": "Hootsuite",
        "distributionMethod": "store"
      },
      {
        "id": "02d14659-a28b-4007-8544-b279c0d3628b",
        "externalId": null,
        "displayName": "Pivotal Tracker",
        "distributionMethod": "store"
      }
    ]));
  });

  it('lists organization\'s apps installed in a team by team id', async () => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/teams/6f6fd3f7-9ba5-4488-bbe6-a789004d0d55/installedApps?$expand=teamsApp&$filter=teamsApp/distributionMethod eq 'organization'`) {
        return Promise.resolve({
          "value": [{
            "id": "NmY2ZmQzZjctOWJhNS00NDg4LWJiZTYtYTc4OTAwNGQwZDU1IyNiOGNjZjNmNC04NGVlLTRlNjItODJkMC1iZjZiZjk1YmRiODM=", "teamsApp": { "id": "b8ccf3f4-84ee-4e62-82d0-bf6bf95bdb83", "externalId": "912e9d76-1794-414f-82fd-e5b60fab731b", "displayName": "HelloWorld", "distributionMethod": "organization" }
          }]
        });
      }

      return Promise.reject('Invalid request');
    });

    await command.action(logger, { options: { debug: false, teamId: '6f6fd3f7-9ba5-4488-bbe6-a789004d0d55' } });
    assert(loggerLogSpy.calledWith([{
      "id": "NmY2ZmQzZjctOWJhNS00NDg4LWJiZTYtYTc4OTAwNGQwZDU1IyNiOGNjZjNmNC04NGVlLTRlNjItODJkMC1iZjZiZjk1YmRiODM=",
      "teamsApp": {
        "id": "b8ccf3f4-84ee-4e62-82d0-bf6bf95bdb83",
        "externalId": "912e9d76-1794-414f-82fd-e5b60fab731b",
        "displayName": "HelloWorld",
        "distributionMethod": "organization"
      },
      "displayName": "HelloWorld",
      "distributionMethod": "organization"
    }]));
  });

  it('lists organization\'s apps installed in a team by team name', async () => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/v1.0/groups?$filter=displayName eq '`) > -1) {
        return Promise.resolve({
          "value": [
            {
              "id": "00000000-0000-0000-0000-000000000000",
              "createdDateTime": null,
              "displayName": "Team Name",
              "description": "Team Description",
              "internalId": null,
              "classification": null,
              "specialization": null,
              "visibility": null,
              "webUrl": null,
              "isArchived": false,
              "isMembershipLimitedToOwners": null,
              "memberSettings": null,
              "guestSettings": null,
              "messagingSettings": null,
              "funSettings": null,
              "discoverySettings": null,
              "resourceProvisioningOptions": ["Team"]
            }
          ]
        });
      }

      if ((opts.url as string).indexOf(`/installedApps?$expand=teamsApp&$filter=teamsApp/distributionMethod eq 'organization'`) > -1) {
        return Promise.resolve({
          "value": [{
            "id": "NmY2ZmQzZjctOWJhNS00NDg4LWJiZTYtYTc4OTAwNGQwZDU1IyNiOGNjZjNmNC04NGVlLTRlNjItODJkMC1iZjZiZjk1YmRiODM=", "teamsApp": { "id": "b8ccf3f4-84ee-4e62-82d0-bf6bf95bdb83", "externalId": "912e9d76-1794-414f-82fd-e5b60fab731b", "displayName": "HelloWorld", "distributionMethod": "organization" }
          }]
        });
      }

      return Promise.reject('Invalid request');
    });

    await command.action(logger, { options: { debug: false, teamName: 'Team Name' } });
    assert(loggerLogSpy.calledWith([{
      "id": "NmY2ZmQzZjctOWJhNS00NDg4LWJiZTYtYTc4OTAwNGQwZDU1IyNiOGNjZjNmNC04NGVlLTRlNjItODJkMC1iZjZiZjk1YmRiODM=",
      "teamsApp": {
        "id": "b8ccf3f4-84ee-4e62-82d0-bf6bf95bdb83",
        "externalId": "912e9d76-1794-414f-82fd-e5b60fab731b",
        "displayName": "HelloWorld",
        "distributionMethod": "organization"
      },
      "displayName": "HelloWorld",
      "distributionMethod": "organization"
    }]));
  });

  it('lists all apps installed in a team', async () => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/teams/6f6fd3f7-9ba5-4488-bbe6-a789004d0d55/installedApps?$expand=teamsApp`) {
        return Promise.resolve({
          "value": [
            {
              "id": "NmY2ZmQzZjctOWJhNS00NDg4LWJiZTYtYTc4OTAwNGQwZDU1IyNiOGNjZjNmNC04NGVlLTRlNjItODJkMC1iZjZiZjk1YmRiODM=", "teamsApp": { "id": "b8ccf3f4-84ee-4e62-82d0-bf6bf95bdb83", "externalId": "912e9d76-1794-414f-82fd-e5b60fab731b", "displayName": "HelloWorld", "distributionMethod": "organization" }
            },
            {
              "id": "NmY2ZmQzZjctOWJhNS00NDg4LWJiZTYtYTc4OTAwNGQwZDU1IyMwZDgyMGVjZC1kZWYyLTQyOTctYWRhZC03ODA1NmNkZTdjNzg=", "teamsApp": { "id": "0d820ecd-def2-4297-adad-78056cde7c78", "externalId": null, "displayName": "OneNote", "distributionMethod": "store" }
            },
            {
              "id": "NmY2ZmQzZjctOWJhNS00NDg4LWJiZTYtYTc4OTAwNGQwZDU1IyMxNGQ2OTYyZC02ZWViLTRmNDgtODg5MC1kZTU1NDU0YmIxMzY=", "teamsApp": { "id": "14d6962d-6eeb-4f48-8890-de55454bb136", "externalId": null, "displayName": "Activity", "distributionMethod": "store" }
            }
          ]
        });
      }

      return Promise.reject('Invalid request');
    });

    await command.action(logger, { options: { debug: false, teamId: '6f6fd3f7-9ba5-4488-bbe6-a789004d0d55', all: true } });
    assert(loggerLogSpy.calledWith([{
      "id": "NmY2ZmQzZjctOWJhNS00NDg4LWJiZTYtYTc4OTAwNGQwZDU1IyNiOGNjZjNmNC04NGVlLTRlNjItODJkMC1iZjZiZjk1YmRiODM=",
      "teamsApp": {
        "id": "b8ccf3f4-84ee-4e62-82d0-bf6bf95bdb83",
        "externalId": "912e9d76-1794-414f-82fd-e5b60fab731b",
        "displayName": "HelloWorld",
        "distributionMethod": "organization"
      },
      "displayName": "HelloWorld",
      "distributionMethod": "organization"
    },
    {
      "id": "NmY2ZmQzZjctOWJhNS00NDg4LWJiZTYtYTc4OTAwNGQwZDU1IyMwZDgyMGVjZC1kZWYyLTQyOTctYWRhZC03ODA1NmNkZTdjNzg=",
      "teamsApp": {
        "id": "0d820ecd-def2-4297-adad-78056cde7c78",
        "externalId": null,
        "displayName": "OneNote",
        "distributionMethod": "store"
      },
      "displayName": "OneNote",
      "distributionMethod": "store"
    },
    {
      "id": "NmY2ZmQzZjctOWJhNS00NDg4LWJiZTYtYTc4OTAwNGQwZDU1IyMxNGQ2OTYyZC02ZWViLTRmNDgtODg5MC1kZTU1NDU0YmIxMzY=",
      "teamsApp": {
        "id": "14d6962d-6eeb-4f48-8890-de55454bb136",
        "externalId": null,
        "displayName": "Activity",
        "distributionMethod": "store"
      },
      "displayName": "Activity",
      "distributionMethod": "store"
    }]));
  });

  it('lists all properties for output json', async () => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps?$filter=distributionMethod eq 'organization'`) {
        return Promise.resolve({
          "value": [
            {
              "id": "7131a36d-bb5f-46b8-bb40-0b199a3fad74",
              "externalId": "4f0cd7c8-995e-4868-812d-d1d402a81eca",
              "displayName": "WsInfo",
              "distributionMethod": "organization"
            }
          ]
        });
      }

      return Promise.reject('Invalid request');
    });

    await command.action(logger, { options: { output: 'json', debug: false } });
    assert(loggerLogSpy.calledWith([
      {
        "id": "7131a36d-bb5f-46b8-bb40-0b199a3fad74",
        "externalId": "4f0cd7c8-995e-4868-812d-d1d402a81eca",
        "displayName": "WsInfo",
        "distributionMethod": "organization"
      }
    ]));
  });

  it('correctly handles error when retrieving apps', async () => {
    sinon.stub(request, 'get').callsFake(() => {
      return Promise.reject('An error has occurred');
    });

    await assert.rejects(command.action(logger, { options: { output: 'json', debug: false } } as any), new CommandError('An error has occurred'));
  });

  it('fails validation if the teamId is not a valid GUID', async () => {
    const actual = await command.validate({
      options: {
        teamId: 'invalid'
      }
    }, commandInfo);
    assert.notStrictEqual(actual, true);
  });

  it('passes validation if the teamId is not specified', async () => {
    const actual = await command.validate({
      options: {
      }
    }, commandInfo);
    assert.strictEqual(actual, true);
  });

  it('passes validation when the teamId is a valid GUID', async () => {
    const actual = await command.validate({
      options: {
        teamId: '6f6fd3f7-9ba5-4488-bbe6-a789004d0d55'
      }
    }, commandInfo);
    assert.strictEqual(actual, true);
  });

  it('supports debug mode', () => {
    const options = command.options;
    let containsOption = false;
    options.forEach(o => {
      if (o.option === '--debug') {
        containsOption = true;
      }
    });
    assert(containsOption);
  });
});