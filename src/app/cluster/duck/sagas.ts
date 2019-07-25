import { takeLatest, select, race, take, put, delay, } from 'redux-saga/effects';
import { ClientFactory } from '../../../client/client_factory';
import { IClusterClient } from '../../../client/client';
import { MigResource, MigResourceKind } from '../../../client/resources';
import {
  ClusterRegistryResource,
  ClusterRegistryResourceKind,
  CoreNamespacedResource,
  CoreNamespacedResourceKind,
} from '../../../client/resources';
import {
  createClusterRegistryObj,
  createTokenSecret,
  createMigCluster,
} from '../../../client/resources/conversions';

import { Creators } from './actions';
import { alertSuccessTimeout, alertErrorTimeout } from '../../common/duck/actions';
import {
  createAddEditStatus,
  AddEditState,
  AddEditMode,
  AddEditStatus,
  defaultAddEditStatus,
  AddEditTimeout,
  AddEditTimeoutPollInterval,
} from '../../common/add_edit_state';

function* addClusterRequest(action)  {
  // TODO: Need to improve this to fall into the failed create state with rollback
  const state = yield select();
  const { migMeta } = state;
  const { clusterValues } = action;
  const client: IClusterClient = ClientFactory.hostCluster(state);

  const clusterReg = createClusterRegistryObj(
    clusterValues.name,
    migMeta.namespace,
    clusterValues.url
  );
  const tokenSecret = createTokenSecret(
    clusterValues.name,
    migMeta.configNamespace,
    clusterValues.token
  );
  const migCluster = createMigCluster(
    clusterValues.name,
    migMeta.namespace,
    clusterReg,
    tokenSecret
  );

  const clusterRegResource = new ClusterRegistryResource(
    ClusterRegistryResourceKind.Cluster,
    migMeta.namespace
  );
  const secretResource = new CoreNamespacedResource(
    CoreNamespacedResourceKind.Secret,
    migMeta.configNamespace
  );
  const migClusterResource = new MigResource(MigResourceKind.MigCluster, migMeta.namespace);

  try {
    const clusterAddResults = yield Promise.all([
      client.create(clusterRegResource, clusterReg),
      client.create(secretResource, tokenSecret),
      client.create(migClusterResource, migCluster),
    ]);

    const cluster = clusterAddResults.reduce((accum, res) => {
      accum[res.data.kind] = res.data;
      return accum;
    }, {});

    put(Creators.addClusterSuccess(cluster));

    // Push into watching state
    put(Creators.setClusterAddEditStatus(
      createAddEditStatus(AddEditState.Watching, AddEditMode.Edit),
    ));
    put(Creators.watchAddClusterRequest(clusterValues.name));
  } catch(err) {
    // TODO: Creation failed, should enter failed creation state here
    // Also need to rollback the objects that were successfully created.
    // Could use Promise.allSettled here as well.
    console.error('Cluster failed creation with error: ', err)
    put(alertErrorTimeout('Cluster failed creation'));
  }
}

function* watchAddClusterRequest() {
  yield takeLatest(Creators.addClusterRequest().type, addClusterRequest);
}

function* pollClusterAddEditStatus(action) {
  while(true) {
    try {
      console.log('Cluster add edit poll status');
      const state = yield select();
      const { migMeta } = state;
      const { clusterName } = action;

      const client: IClusterClient = ClientFactory.hostCluster(state);
      const migClusterResource = new MigResource(MigResourceKind.MigCluster, migMeta.namespace);
      const clusterPollResult = client.get(migClusterResource, clusterName);
      console.log('Got cluster poll result: ', clusterPollResult);

      // TODO: If the condition is present, return a new status!

      yield delay(AddEditTimeoutPollInterval);
    } catch(err) {
      // TODO: what happens when the poll fails? Back into that hard error state?
      console.log('Hard error branch hit in poll cluster add edit', err);
      break;
    }
  }
}

function* watchClusterAddEditStatus() {
  console.log('watch cluster add edit status triggered, falling into a race!');
  // Start a race, poll until the watch is cancelled (by closing the modal),
  // polling times out, or the condition is added, in that order of precedence.
  const raceResult = yield race({
    addEditResult: takeLatest(Creators.watchClusterAddEditStatus().type, pollClusterAddEditStatus),
    timeout: delay(AddEditTimeout),
    cancel: take(Creators.cancelWatchClusterAddEditStatus()),
  });
  console.log('race finished. got result: ', raceResult);

  if(raceResult.cancel) {
    return;
  }

  const addEditResult: AddEditStatus = raceResult.addEditResult;

  const statusToDispatch = addEditResult || createAddEditStatus(
    AddEditState.TimedOut, AddEditMode.Edit);

  put(Creators.setClusterAddEditStatus(statusToDispatch));
}

export default {
  watchAddClusterRequest,
  watchClusterAddEditStatus
};