import React, { Fragment, useEffect, useState } from "react";
import { view } from '@forge/bridge';
import { Router, Route, Routes } from "react-router";
import BulkOperationPanel from "./panel/BulkOperationPanel";
import importModel from "./model/importModel";
import moveModel from "./model/moveModel";
import editModel from "./model/editModel";
import { bulkEditEnabled, bulkImportEnabled, bulkMoveEnabled } from "./model/config";
import { BulkOperationMode } from "./types/BulkOperationMode";
import { BulkOpsModel } from "./model/BulkOpsModel";
import './Main.css';

export type HomeProps = {
  history: any;
}

// https://developer.atlassian.com/platform/forge/add-routing-to-a-full-page-app/
// https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/view/#createhistory
const Home = (props: HomeProps) => {

  const renderMainPanel = (path: string, title: string, description: string) => {
    return (
      <div className="padding-panel" onClick={() => {
        props.history.push(`/${path}`);
      }}>
        <div className="content-panel">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
    );
  }

  return (
    <Fragment>
      <div>
        <h1>Bulk Work Item Operations</h1>
        <div className="bulk-move-main-panel clickable">
          {bulkMoveEnabled ? renderMainPanel('move', 'Bulk Move Work Items', `Use this functionality to move a large number of work items from one or more projects to another project.`) : null}
          {bulkEditEnabled ? renderMainPanel('edit', 'Bulk Edit Work Items', `Use this functionality to edit a large number of work items in a similar way to each other.`) : null }
          {bulkImportEnabled ? renderMainPanel('import', 'Bulk Import Work Items', `Using this functionality to import a large number of work items.`) : null }
        </div>
      </div>
    </Fragment>
  );
}

const Main = () => {

  const [history, setHistory] = useState<import("history").History>(null);

  const initialiseHistory = async () => {
    const history = await view.createHistory();
    setHistory(history);
  }

  useEffect(() => {
    initialiseHistory();
  }, []);

  const [historyState, setHistoryState] = useState(null);

  useEffect(() => {
    if (!historyState && history) {
      // The initial values of action and location will be the app URL
      setHistoryState({
        action: history.action,
        location: history.location,
      });
    }
  }, [history, historyState]);

  useEffect(() => {
    if (history) {
      // Starts listening for location changes and calls the given callback when changed
      history.listen((location, action) => {
        setHistoryState({
          action,
          location,
        });
      });
    }
  }, [history]);

  const renderBulkOperationRoute = (path: string, bulkOperationMode: BulkOperationMode, model: BulkOpsModel<any>, enabled: boolean = true) => {
    const element: React.ReactElement = enabled ? (
      <BulkOperationPanel
        key={bulkOperationMode}
        bulkOperationMode={bulkOperationMode}
        bulkOpsModel={model}
      />
    ) : (
      <div>
        <h3>Feature not enabled</h3>
        <p>This feature is not enabled in your app configuration.</p>
      </div>
    );
    return (
      <Route
        path={path}
        key={path}
        element={element}
      ></Route>
    );
  }

  return (
    <div>
      {history && historyState ? (
        <Router
          navigator={history}
          navigationType={historyState.action}
          location={historyState.location}
        >
          <Routes>
            <Route path="/" element={<Home history={history} />}></Route>
            {renderBulkOperationRoute('/move', 'Move', moveModel, bulkMoveEnabled)}
            {renderBulkOperationRoute('/edit', 'Edit', editModel, bulkEditEnabled)}
            {renderBulkOperationRoute('/import', 'Import', importModel, bulkImportEnabled)}
          </Routes>
        </Router>
      ) : (
        "Loading..."
      )}
    </div>
  );
}

export default Main;
