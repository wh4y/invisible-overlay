import { useEffect, useRef, useState } from 'react';
import { Editor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import Placeholder from '@tiptap/extension-placeholder';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const YJS_WS_ENDPOINT = "ws://localhost:8080";
const YJS_ROOM = "1e21d44448ddc6fc204946fc25b28cc3";

function App() {
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isSynced, setIsSynced] = useState(false);
  const [editor, setEditor] = useState(null);
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const yxmlFragmentRef = useRef(null);


  // Initialize Yjs first
  useEffect(() => {
    console.log("[overlay] Connecting to Yjs server:", YJS_WS_ENDPOINT, "room:", YJS_ROOM);

    // Create Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Get fragment TipTap expects
    const yxmlFragment = ydoc.getXmlFragment('default');
    yxmlFragmentRef.current = yxmlFragment;

    console.log("[overlay] Created Yjs XML fragment: prosemirror");

    // Connect to Yjs WebSocket server
    const provider = new WebsocketProvider(YJS_WS_ENDPOINT, YJS_ROOM, ydoc);
    providerRef.current = provider;

    // Ensure provider exposes the doc
    if (!provider.doc) {
      provider.doc = ydoc;
    }
    
    provider.on("status", ({ status }) => {
      console.log("[overlay] Yjs connection status:", status);
      setConnectionStatus(status);

      if (status === "connected") {
        console.log("[overlay] ✅ Connected to Yjs server");
        setIsSynced(provider.synced);
      } else if (status === "disconnected") {
        console.warn("[overlay] ⚠️  Disconnected from Yjs server");
      } else if (status === "connecting") {
        console.log("[overlay] 🔄 Connecting to Yjs server...");
      }
    });

    const handleSynced = (synced) => {
    
      console.log("[overlay] 🧠 Collaboration synced:", synced);
      setIsSynced(synced);
      if (synced) {
        try {
          const fragmentSnapshot = yxmlFragment.toJSON();
          console.log("[overlay] 📄 Synced doc snapshot:", fragmentSnapshot);
        } catch (error) {
          console.warn("[overlay] ⚠️ Could not snapshot doc after sync:", error);
        }
      }
    };
    provider.on("synced", handleSynced);

    const logDocUpdate = (update, origin) => {
      const bytes = update?.length ?? 0;
      const fromServer = origin === provider;
      const preview = update ? Array.from(update).slice(0, 24) : [];
      console.log("[overlay] 🔁 Yjs update received", {
        bytes,
        from: fromServer ? "server" : "local",
        preview,
      });
      try {
        const fragmentSnapshot = yxmlFragment.toJSON();
        console.log("[overlay] 🧾 Current doc snapshot:", fragmentSnapshot);
      } catch (error) {
        console.warn("[overlay] ⚠️ Failed to inspect doc state:", error);
      }
    };
    ydoc.on("update", logDocUpdate);

    provider.on("connection-error", (error) => {
      console.error("[overlay] ❌ Connection error:", error);
    });

    provider.on("connection-close", (event) => {
      console.warn("[overlay] ⚠️  Connection closed:", event);
    });

    // Debug: Check if WebSocket is connecting
    setTimeout(() => {
      console.log("[overlay] Provider state:", {
        wsconnected: provider.wsconnected,
        wsconnecting: provider.wsconnecting,
        synced: provider.synced
      });
    }, 2000);

    // Cleanup
    return () => {
      if (provider) {
        provider.off("synced", handleSynced);
        provider.destroy();
      }
      if (ydoc) {
        ydoc.off("update", logDocUpdate);
        ydoc.destroy();
      }
    };
  }, []);

  // Create/destroy TipTap editor manually to align with working client logic
  useEffect(() => {
    if (!isSynced || !ydocRef.current || !providerRef.current || !yxmlFragmentRef.current) {
      return undefined;
    }

    console.log("[overlay] 🚀 Creating TipTap editor instance");
    const tiptapEditor = new Editor({
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        Placeholder.configure({
          placeholder: 'Start collaborating... type / for commands ✨',
        }),
        Collaboration.configure({
          fragment: yxmlFragmentRef.current,
        }),
      ],
      editorProps: {
        attributes: {
          class: 'tiptap-editor',
        },
      },
      enableInputRules: true,
      enablePasteRules: true,
    });

    setEditor(tiptapEditor);
    console.log("[overlay] ✅ TipTap editor initialized with Yjs collaboration");

    return () => {
      console.log("[overlay] 🧹 Destroying TipTap editor");
      tiptapEditor.destroy();
      setEditor(null);
    };
  }, [isSynced]);

  // Sync with Electron window resize
  useEffect(() => {
    const updateSize = (electronWidth, electronHeight) => {
      // Use provided Electron dimensions or fallback to window
      const width = electronWidth || window.innerWidth;
      const height = electronHeight || window.innerHeight;
      
      // Ensure we don't exceed window bounds
      const maxWidth = Math.min(width, window.innerWidth || width);
      const maxHeight = Math.min(height, window.innerHeight || height);
      
      // Update container to fit window with padding (12px margin on each side = 24px total)
      const container = document.querySelector('.container');
      if (container) {
        const containerWidth = maxWidth - 24;
        const containerHeight = maxHeight - 24;
        
        container.style.width = `${containerWidth}px`;
        container.style.height = `${containerHeight}px`;
        container.style.maxWidth = `${containerWidth}px`;
        container.style.maxHeight = `${containerHeight}px`;
        
        // Ensure no overflow
        container.style.overflow = 'hidden';
      }
      
      // Update root and body to match Electron window
      document.documentElement.style.width = `${maxWidth}px`;
      document.documentElement.style.height = `${maxHeight}px`;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.width = `${maxWidth}px`;
      document.body.style.height = `${maxHeight}px`;
      document.body.style.overflow = 'hidden';
      
      console.log('[overlay-react] Updated size:', { 
        electronWidth: width, 
        electronHeight: height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        containerWidth: maxWidth - 24, 
        containerHeight: maxHeight - 24 
      });
    };

    // Listen to browser window resize
    const handleWindowResize = () => {
      updateSize();
    };
    window.addEventListener('resize', handleWindowResize);
    
    // Listen to Electron window resize messages via IPC
    let cleanupResizeListener = null;
    if (window.overlayAPI && window.overlayAPI.onWindowResize) {
      cleanupResizeListener = window.overlayAPI.onWindowResize(({ width, height }) => {
        console.log('[overlay-react] Received window resize from Electron:', { width, height });
        if (width && height) {
          updateSize(width, height);
        }
      });
    }
    
    // Initial sync - get size from Electron if available
    if (window.overlayAPI && window.overlayAPI.getBounds) {
      window.overlayAPI.getBounds().then((bounds) => {
        if (bounds) {
          updateSize(bounds.width, bounds.height);
        } else {
          updateSize();
        }
      }).catch(() => updateSize());
    } else {
      updateSize();
    }
    
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (cleanupResizeListener) cleanupResizeListener();
    };
  }, []);

  return (
    <div className="container">
      <div className="title">Notes</div>
      {!editor ? (
        <div className="tiptap-editor" style={{ pointerEvents: 'auto' }}>
          Loading editor...
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}
      <div className="hint">
        {!editor && 'Initializing...'}
        {editor && connectionStatus === 'connecting' && 'Connecting to Yjs server...'}
        {editor && connectionStatus === 'connected' && 'Connected • Toggle: Ctrl+Shift+Space • Reset: Ctrl+Shift+R'}
        {editor && connectionStatus === 'disconnected' && 'Disconnected. Reconnecting...'}
      </div>
    </div>
  );
}

export default App;

