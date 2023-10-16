import * as React from 'react';
import { useEffect, useState } from 'react';
import { useStatePersist } from 'use-state-persist';

import * as ReactDOM from 'react-dom';
import { broadcastToRelay, Connect, connectToRelay, ConnectURI } from '@nostr-connect/connect';

import { QRCodeSVG } from 'qrcode.react';
import { getEventHash, getPublicKey, Event, generatePrivateKey } from 'nostr-tools';

const relayUrl = 'wss://relay.damus.io';

const App = () => {
  const [pubkey, setPubkey] = useStatePersist('@pubkey', '');
  const [secretKey, setSecretKey] = useStatePersist('@secretKey', '');
  const [getPublicKeyReply, setGetPublicKeyReply] = useState('');
  const [eventWithSig, setEvent] = useState({});
  const [schnorrSig, setSchnorrSig] = useState('');
  const [delegationSig, setDelegateSig] = useState('');

  React.useMemo(() => {
    if (secretKey === '') {
      setSecretKey(generatePrivateKey());
    }
  }, [secretKey])

  const connectURI = React.useMemo(() => secretKey ? new ConnectURI({
    target: getPublicKey(secretKey),
    relay: relayUrl,
    metadata: {
      name: 'Nostr Connect Playground',
      description: '🔉🔉🔉',
      url: 'https://example.com',
      icons: ['https://example.com/icon.png'],
    },
  }) : undefined, [secretKey])

  useEffect(() => {
    (async () => {
      const target = pubkey.length > 0 ? pubkey : undefined;
      const connect = new Connect({
        secretKey,
        target,
        relay: relayUrl
      });
      connect.events.on('connect', (pubkey: string) => {
        setPubkey(pubkey);
      });
      connect.events.on('disconnect', () => {
        setEvent({});
        setPubkey('');
        setGetPublicKeyReply('');
        setSecretKey('');
      });
      await connect.init();
    })();
  }, [pubkey]);


  const getPub = async () => {
    if (pubkey.length === 0) return;
    const connect = new Connect({
      secretKey,
      target: pubkey,
      relay: relayUrl,
    });
    const pk = await connect.getPublicKey();
    setGetPublicKeyReply(pk);
  }

  const sendMessage = async () => {
    try {
      if (pubkey.length === 0) return;

      const connect = new Connect({
        secretKey,
        target: pubkey,
        relay: relayUrl,
      });

      let event: Event = {
        kind: 1,
        pubkey: pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: "Running Nostr Connect 🔌",
        id: '',
        sig: '',
      };
      event.id = getEventHash(event)
      event.sig = (await connect.signEvent(event)).sig;
      const relay = await connectToRelay(relayUrl);
      await broadcastToRelay(relay, event, true);

      setEvent(event);
    } catch (error) {
      console.error(error);
    }

  }

  const getSchnorrSig = async () => {
    try {
      if (pubkey.length === 0) return;

      const connect = new Connect({
        secretKey,
        target: pubkey,
        relay: relayUrl,
      });

      const sig = await connect.rpc.call({
        target: pubkey,
        request: {
          method: 'sign_schnorr',
          params: ['Hello World'],
        }
      });
      setSchnorrSig(sig);
    } catch (error) {
      console.error(error);
    }
  }

  const delegate = async () => {
    try {
      if (pubkey.length === 0) return;

      const connect = new Connect({
        secretKey,
        target: pubkey,
        relay: relayUrl,
      });

      const sig = await connect.rpc.call({
        target: pubkey,
        request: {
          method: 'delegate',
          params: [
            getPublicKey(secretKey),
            {
              kind: 0,
              until: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
            }
          ],
        }
      });
      setDelegateSig(sig);
    } catch (error) {
      console.error(error);
    }
  }

  const isConnected = () => {
    return pubkey.length > 0;
  }

  const disconnect = async () => {
    const connect = new Connect({
      secretKey,
      target: pubkey,
      relay: relayUrl,
    });
    await connect.disconnect();
    //cleanup
    setEvent({});
    setPubkey('');
    setSecretKey('');
    setGetPublicKeyReply('');
  }

  const copyToClipboard = () => {
    if (!connectURI) {
      throw new Error("Not ready");
    }
    navigator.clipboard.writeText(connectURI.toString()).then(undefined,
      function (err) {
        console.error('Async: Could not copy text: ', err);
      });
  }

  if (!secretKey || !connectURI) {
    return <p>Loading...</p>;
  }

  return (
    <div className='hero is-fullheight has-background-black has-text-white'>
      <section className="container">
        <div className='content'>
          <h1 className='title has-text-white'>Nostr Connect Playground</h1>
        </div>
        <div className='content'>
          <p className='subtitle is-6 has-text-white'><b>Nostr ID</b> {getPublicKey(secretKey)}</p>
        </div>
        <div className='content'>
          <p className='subtitle is-6 has-text-white'><b>Status</b> {isConnected() ? '🟢 Connected' : '🔴 Disconnected'}</p>
        </div>
       {
       isConnected() && <div className='content'>
          <button className='button is-danger' onClick={disconnect}>
            <p className='subtitle is-6 has-text-white'>💤 <i>Disconnect</i></p>
          </button>
        </div>
        }
        {!isConnected() && <div className='content has-text-centered'>
          <div className='notification is-dark'>
            <h2 className='title is-5'>Connect with Nostr</h2>

            <QRCodeSVG value={connectURI.toString()} />
            <input
              className='input is-info'
              type='text'
              value={connectURI.toString()}
              readOnly
            />
            <button className='button is-info mt-3' onClick={copyToClipboard}>
              Copy to clipboard
            </button>
          </div>
        </div>
        }
        {
          isConnected() &&
          <div className='notification is-dark'>
            <div className='content'>
              <h2 className='title is-5 has-text-white'>Get Public Key</h2>
              <button className='button is-info has-text-white' onClick={getPub}>
                Get public key
              </button>
              {getPublicKeyReply.length > 0 && <input
                className='input is-info mt-3'
                type='text'
                value={getPublicKeyReply}
                readOnly
              />}
            </div>
            <div className='content'>
              <h2 className='title is-5 has-text-white'>Post a message on Damus relay with text <b>Running Nostr Connect 🔌</b></h2>
              <button className='button is-info' onClick={sendMessage}>
                Sign Event
              </button>
              {
                Object.keys(eventWithSig).length > 0 &&
                <textarea
                  className="textarea"
                  readOnly
                  rows={12}
                  defaultValue={JSON.stringify(eventWithSig, null, 2)}
                />
              }
            </div>
            <div className='content'>
              <h2 className='title is-5 has-text-white'>Get a Schnorr signature for the message <b>Hello World</b></h2>
              <button className='button is-info' onClick={getSchnorrSig}>
                Sign Schnorr
              </button>
              {
                Object.keys(schnorrSig).length > 0 &&
                <input
                className='input is-info mt-3'
                type='text'
                value={schnorrSig}
                readOnly
              />
              }
            </div>
            <div className='content'>
              <h2 className='title is-5 has-text-white'>Delegate this app to make signature for 1 day</h2>
              <button className='button is-info' onClick={delegate}>
                Delegate
              </button>
              {
                Object.keys(delegationSig).length > 0 &&
                <input
                className='input is-info mt-3'
                type='text'
                value={delegationSig}
                readOnly
              />
              }
            </div>
          </div>
        }
      </section>
    </div>


  )
}
ReactDOM.render(<App />, document.getElementById('root'));
