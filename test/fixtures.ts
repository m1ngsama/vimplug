import { createServer } from 'node:http'

const PAGES: Record<string, string> = {
  '/tall': '<body style="height:5000px">hi</body>',
  '/textarea': '<body style="height:5000px"><textarea id="t"></textarea></body>',
  '/editable': '<body style="height:5000px"><div id="e" contenteditable></div></body>',
  '/shadow': '<body style="height:5000px"><div id="h"></div></body>',
  // No test query, nor any prefix of one, may appear here: find is incremental.
  '/find': `<body>
      <div style="height:2000px">top</div>
      <p id="needle">findmethistext</p>
      <div style="height:2000px">bottom</div>
    </body>`,
  '/pointer': `<body style="height:5000px">
      <button id="p">skip</button>
      <script>
        document.getElementById('p').addEventListener('pointerdown', () => {
          document.title = 'pointer-seen'
        })
      </script>
    </body>`,
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
  '/row': `<body style="height:5000px"><div>
      <a href="/tall"><span style="display:inline-block;width:40px;height:40px"></span></a>
      <a href="/tall">name</a>
      <a href="/textarea">other</a>
    </div></body>`,
  '/scripted': `<body style="height:5000px">
      <div style="cursor:pointer"><a href="/tall">inner</a></div>
      <div id="card" style="cursor:pointer"><span>card</span></div>
      <script>
        document.getElementById('card').addEventListener('click', () => {
          document.title = 'clicked'
        })
      </script>
    </body>`,
  '/cmdk': `<body style="height:5000px"><div id="out"></div><script>
      document.addEventListener('keydown', e => {
        if (e.metaKey && e.key === 'k') {
          e.preventDefault()
          document.getElementById('out').textContent = 'page-saw-it'
        }
      })
    </script></body>`,
  '/steals': `<body style="height:5000px"><input id="s">
      <script>document.getElementById('s').focus()</script></body>`,
  '/focusfight': `<body style="height:5000px">
      <input id="trap">
      <script>
        document.addEventListener('focusin', e => {
          if (e.target.id !== 'trap') setTimeout(() => document.getElementById('trap').focus(), 0)
        }, true)
      </script>
    </body>`,
  '/refocus': `<body style="height:5000px">
      <input id="trap">
      <script>setInterval(() => document.getElementById('trap').focus(), 50)</script>
    </body>`,
  '/shortcuts': `<body style="height:5000px">
      <input id="site-search">
      <script>
        document.addEventListener('keydown', e => {
          const t = e.target
          const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
            t.isContentEditable)
          if (!typing && e.key === 's') document.getElementById('site-search').focus()
        })
      </script>
    </body>`,
  '/twice': `<body>
      <div style="height:1500px">top</div>
      <p id="one">alpha marker</p>
      <div style="height:1500px">mid</div>
      <p id="two">beta marker</p>
      <div style="height:1500px">end</div>
    </body>`,
  '/blocks': `<body style="height:3000px">
      <div style="height:1200px">top</div>
      <p>abc</p>
      <p>def</p>
      <div style="height:1200px">tail</div>
    </body>`,
  '/hidden': `<body style="height:3000px">
      <div style="height:1200px">top</div>
      <div style="display:none">hiddenword</div>
      <p>visible</p>
    </body>`,
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
