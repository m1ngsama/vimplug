import { createServer } from 'node:http'

// Content scripts do not match about:blank or data: URLs, so fixtures need a real origin.
const PAGES: Record<string, string> = {
  '/tall': '<body style="height:5000px">hi</body>',
  '/textarea': '<body style="height:5000px"><textarea id="t"></textarea></body>',
  '/editable': '<body style="height:5000px"><div id="e" contenteditable></div></body>',
  '/shadow': '<body style="height:5000px"><div id="h"></div></body>',
  // No query any test types may appear here, or a working find reads the same as a leaked
  // scroll command. Incremental search means every prefix has to miss too.
  '/find': `<body>
      <div style="height:2000px">top</div>
      <p id="needle">findmethistext</p>
      <div style="height:2000px">bottom</div>
    </body>`,
  // A control that only reacts to the pointer sequence, like YouTube's skip-ad button.
  '/pointer': `<body style="height:5000px">
      <button id="p">skip</button>
      <script>
        document.getElementById('p').addEventListener('pointerdown', () => {
          document.title = 'pointer-seen'
        })
      </script>
    </body>`,
  // The shape of Gmail, Slack and most docs sites: the page does not scroll, a pane does.
  '/pane': `<body style="margin:0;height:100vh;overflow:hidden">
      <div id="pane" style="height:100vh;overflow-y:auto" tabindex="0">
        <div style="height:5000px">pane content</div>
      </div>
    </body>`,
  '/links': `<body style="height:5000px">
      <a id="a1" href="/tall">one</a>
      <a id="a2" href="/textarea">two</a>
      <button id="b1" onclick="document.title='clicked'">three</button>
    </body>`,
  '/cmdk': `<body style="height:5000px"><div id="out"></div><script>
      document.addEventListener('keydown', e => {
        if (e.metaKey && e.key === 'k') {
          e.preventDefault()
          document.getElementById('out').textContent = 'page-saw-it'
        }
      })
    </script></body>`,
  // A site that focuses its own search box on load.
  '/steals': `<body style="height:5000px"><input id="s">
      <script>document.getElementById('s').focus()</script></body>`,
  // A focus trap: the page takes focus back whenever anything else gains it. The shape of
  // an editor, a modal, or any site that insists on keeping the caret.
  '/focusfight': `<body style="height:5000px">
      <input id="trap">
      <script>
        document.addEventListener('focusin', e => {
          if (e.target.id !== 'trap') setTimeout(() => document.getElementById('trap').focus(), 0)
        }, true)
      </script>
    </body>`,
  // Refocuses on a timer, regardless of events, so hiding focus events is not enough.
  '/refocus': `<body style="height:5000px">
      <input id="trap">
      <script>setInterval(() => document.getElementById('trap').focus(), 50)</script>
    </body>`,
  // Two matches far apart, so n has somewhere to go.
  '/twice': `<body>
      <div style="height:1500px">top</div>
      <p id="one">alpha marker</p>
      <div style="height:1500px">mid</div>
      <p id="two">beta marker</p>
      <div style="height:1500px">end</div>
    </body>`,
  // A match split across text nodes, and characters a regex would read as syntax.
  '/awkward': `<body>
      <div style="height:2000px">top</div>
      <p id="split">wo<span>rd</span>break</p>
      <p id="meta">cost is $5.00 (approx) [sic] a+b*c</p>
      <div style="height:2000px">bottom</div>
    </body>`,
}

export async function serveFixtures(): Promise<{ base: string; stop(): Promise<void> }> {
  const server = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0] ?? ''
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(`<!doctype html><html>${PAGES[path] ?? '<body>not found</body>'}</html>`)
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  return {
    base: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>(r => server.close(() => r())),
  }
}
