import React from 'react';
import ReactDOM from 'react-dom';
import '@atlaskit/css-reset';
// import './Main.css';
import Main from './Main';
import { view } from "@forge/bridge";


const renderApp = async (): Promise<void> => {
  await view.theme.enable();
  ReactDOM.render(
    <React.StrictMode>
      <Main />
    </React.StrictMode>,
    document.getElementById('root')
  );
}

renderApp();
