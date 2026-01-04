import { WebScanner } from '../core/WebScanner';
import { ActRuleRegistry } from '../core/acts/ActRuleRegistry';
import { AuditReport, AccessibilityViolation } from '../core/types';

interface ActTestCase {
    url: string;
    expected: 'pass' | 'fail' | 'inapplicable';
    description: string;
}

interface ActRuleMapping {
    actRuleId: string;
    actRuleName: string;
    ourRuleId: string;
    testCases: ActTestCase[];
}

// Define the test suite
const ACT_SUITE: ActRuleMapping[] = [
    {
        actRuleId: '9eb3f6',
        actRuleName: 'Image filename as accessible name',
        ourRuleId: 'a11yflow-suspicious-alt',
        testCases: [
            {
                description: 'Image with filename as alt text (Exact match)',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><img src="photo.jpg" alt="photo.jpg"></body></html>',
                expected: 'fail'
            },
            {
                description: 'Image with filename as alt text (Case insensitive)',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><img src="IMG_123.JPG" alt="img_123.jpg"></body></html>',
                expected: 'fail'
            },
            {
                description: 'Image with valid alt text',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><img src="photo.jpg" alt="A beautiful sunset"></body></html>',
                expected: 'pass'
            },
            {
                description: 'Image with placeholder text "image"',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><img src="cat.png" alt="image"></body></html>',
                expected: 'fail'
            }
        ]
    },
    {
        actRuleId: 'n427av', // Approximate mapping to Error Identification
        actRuleName: 'Form Error Identification',
        ourRuleId: 'a11yflow-form-errors',
        testCases: [
            {
                description: 'Form with required field and no error handling',
                // A form that submits to itself (reload) without preventing default, and has no JS validation
                // We use onsubmit="event.preventDefault()" to simulate a SPA form that fails silently
                // We use novalidate to prevent browser native validation bubbles, simulating a custom form that forgot to validate
                // Note: We use action="" instead of action="#" because # in data URI is interpreted as fragment
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><form action="" novalidate onsubmit="event.preventDefault();"><label for="name">Name</label><input id="name" required><button type="submit">Submit</button></form></body></html>',
                expected: 'fail'
            },
            {
                description: 'Form with HTML5 validation (Browser handles it)',
                // If browser validation is active, our scanner should see it blocks submission or shows a bubble
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><form action=""><label for="email">Email</label><input id="email" type="email" required><button type="submit">Submit</button></form></body></html>',
                expected: 'pass' // Our scanner considers native validation as "communicating error"
            }
        ]
    },
    {
        actRuleId: '5f99a7', // Approximate mapping to Modal Focus
        actRuleName: 'Modal Dialog Focus Management',
        ourRuleId: 'a11yflow-modal-focus',
        testCases: [
            {
                description: 'Dialog with correct focus management',
                // A dialog that is open and has focus inside
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><div role="dialog" aria-modal="true" aria-label="Test Dialog"><button>Close</button></div></body></html>',
                expected: 'pass'
            },
            {
                description: 'Dialog missing aria-modal="true"',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><div role="dialog" aria-label="Test Dialog"><button>Close</button></div></body></html>',
                expected: 'fail'
            },
            {
                description: 'Dialog missing close button',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><div role="dialog" aria-modal="true" aria-label="Test Dialog"><p>Hello</p></div></body></html>',
                expected: 'fail'
            }
        ]
    },
    {
        actRuleId: 'cf77f2', // Bypass Blocks of Repeated Content
        actRuleName: 'Skip Link Mechanism',
        ourRuleId: 'a11yflow-skip-link',
        testCases: [
            {
                description: 'Page with valid skip link',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><a href="%23main">Skip to main content</a><nav>Navigation</nav><main id="main">Main Content</main></body></html>',
                expected: 'pass'
            },
            {
                description: 'Page with broken skip link target',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><a href="%23missing">Skip to main content</a><nav>Navigation</nav><main id="main">Main Content</main></body></html>',
                expected: 'fail'
            },
            {
                description: 'Page with skip link hidden until focus',
                // Common pattern: .sr-only class that becomes visible on focus
                // We simulate this by checking if our scanner detects it even if it's visually hidden initially
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title><style>.sr-only { position: absolute; left: -9999px; } .sr-only:focus { left: 0; }</style></head><body><a href="%23main" class="sr-only">Skip to main content</a><nav>Navigation</nav><main id="main">Main Content</main></body></html>',
                expected: 'pass'
            }
        ]
    },
    {
        actRuleId: 'b40fd1', // Document has a landmark with non-repeated content
        actRuleName: 'Landmarks',
        ourRuleId: 'a11yflow-landmarks',
        testCases: [
            {
                description: 'Page with one main landmark',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><header>Header</header><main>Main Content</main><footer>Footer</footer></body></html>',
                expected: 'pass'
            },
            {
                description: 'Page with role="main" instead of <main>',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><div role="main">Main Content</div></body></html>',
                expected: 'pass'
            },
            {
                description: 'Page with no main landmark',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><header>Header</header><div>Content</div><footer>Footer</footer></body></html>',
                expected: 'fail'
            },
            {
                description: 'Page with two visible main landmarks',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><main>Main 1</main><main>Main 2</main></body></html>',
                expected: 'fail'
            }
        ]
    },
    {
        actRuleId: '2eb176',
        actRuleName: 'Carousel Autoplay',
        ourRuleId: 'a11yflow-carousel-autoplay',
        testCases: [
            {
                description: 'Auto-rotating carousel without pause button',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><div class="carousel" role="region" aria-roledescription="carousel">Slide 1</div><script>setInterval(() => { document.querySelector(".carousel").textContent = "Slide " + Date.now(); }, 1000);</script></body></html>',
                expected: 'fail'
            },
            {
                description: 'Auto-rotating carousel WITH pause button',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><div class="carousel" role="region" aria-roledescription="carousel">Slide 1<button>Pause</button></div><script>setInterval(() => { document.querySelector(".carousel").firstChild.textContent = "Slide " + Date.now(); }, 1000);</script></body></html>',
                expected: 'pass'
            },
            {
                description: 'Static carousel (no auto-rotation)',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><div class="carousel" role="region" aria-roledescription="carousel">Slide 1</div></body></html>',
                expected: 'pass'
            }
        ]
    },
    {
        actRuleId: 'b4f0c3',
        actRuleName: 'Meta Viewport Zoom',
        ourRuleId: 'a11yflow-meta-viewport',
        testCases: [
            {
                description: 'Viewport with user-scalable=no',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title><meta name="viewport" content="width=device-width, user-scalable=no"></head><body>Content</body></html>',
                expected: 'fail'
            },
            {
                description: 'Viewport with maximum-scale=1.0',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title><meta name="viewport" content="width=device-width, maximum-scale=1.0"></head><body>Content</body></html>',
                expected: 'fail'
            },
            {
                description: 'Viewport with valid settings',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>Content</body></html>',
                expected: 'pass'
            },
            {
                description: 'No meta viewport',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>Content</body></html>',
                expected: 'pass'
            }
        ]
    },
    {
        actRuleId: 'b33eff',
        actRuleName: 'Orientation Lock',
        ourRuleId: 'a11yflow-orientation-lock',
        testCases: [
            {
                description: 'Page locked to landscape (rotates in portrait)',
                // Simulate CSS that rotates body when in portrait (width < height)
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title><style>@media (orientation: portrait) { body { transform: rotate(90deg); transform-origin: center; } }</style></head><body>Please rotate your device</body></html>',
                expected: 'fail'
            },
            {
                description: 'Page locked to portrait (rotates in landscape)',
                // Simulate CSS that rotates body when in landscape (width > height)
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title><style>@media (orientation: landscape) { body { transform: rotate(-90deg); } }</style></head><body>Please rotate your device</body></html>',
                expected: 'fail'
            },
            {
                description: 'Responsive page (no rotation)',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title><style>body { background: white; }</style></head><body>Content</body></html>',
                expected: 'pass'
            }
        ]
    },
    {
        actRuleId: '80f0bf',
        actRuleName: 'Autoplay Audio Control',
        ourRuleId: 'a11yflow-autoplay-media',
        testCases: [
            {
                description: 'Audio autoplaying > 3 seconds',
                // We mock the audio element properties to simulate playing, 
                // because headless browsers often block autoplay or lack codecs for external files.
                url: `data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>
                  <audio id="test-audio" autoplay loop></audio>
                  <script>
                    const audio = document.getElementById('test-audio');
                    // Mock properties to simulate playing
                    Object.defineProperty(audio, 'paused', { value: false });
                    Object.defineProperty(audio, 'muted', { value: false });
                    Object.defineProperty(audio, 'duration', { value: 10 });
                    
                    // Mock currentTime to increment
                    Object.defineProperty(audio, 'currentTime', { 
                        get: () => {
                            const now = Date.now();
                            if (!audio._startTime) audio._startTime = now;
                            return (now - audio._startTime) / 1000; 
                        }
                    });
                    // Mock play to do nothing but return resolved promise
                    audio.play = () => Promise.resolve();
                  </script>
                </body></html>`,
                expected: 'fail' 
            },
            {
                description: 'Video autoplaying but muted',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><video src="https://www.w3schools.com/html/mov_bbb.mp4" autoplay muted loop></video></body></html>',
                expected: 'pass'
            },
            {
                description: 'Audio paused by default',
                url: 'data:text/html,<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><audio src="https://www.w3schools.com/html/horse.mp3" controls></audio></body></html>',
                expected: 'pass'
            }
        ]
    }
];

function findViolation(report: AuditReport, ruleId: string): AccessibilityViolation | undefined {
    const allViolations = [
        ...report.violations.critical,
        ...report.violations.serious,
        ...report.violations.moderate,
        ...report.violations.minor
    ];
    return allViolations.find(v => v.id === ruleId);
}

async function runActTests() {
    console.log('🚀 Starting ACT Rules Verification...\n');
    
    const scanner = new WebScanner();
    let totalTests = 0;
    let passedTests = 0;

    for (const rule of ACT_SUITE) {
        console.log(`Testing Rule: ${rule.actRuleName} (${rule.actRuleId}) -> Our Rule: ${rule.ourRuleId}`);
        console.log('---------------------------------------------------');

        for (const testCase of rule.testCases) {
            totalTests++;
            process.stdout.write(`  • ${testCase.description}... `);

            try {
                const report = await scanner.scan(testCase.url);
                
                // Check if our rule reported a violation
                const violation = findViolation(report, rule.ourRuleId);
                const hasViolation = !!violation;

                let result: 'pass' | 'fail';
                
                // If we expected a fail (violation), and we got one -> Success
                if (testCase.expected === 'fail') {
                    result = hasViolation ? 'pass' : 'fail';
                } else {
                    // If we expected a pass (no violation), and we got none -> Success
                    result = !hasViolation ? 'pass' : 'fail';
                }

                if (result === 'pass') {
                    console.log('✅ PASS');
                    passedTests++;
                } else {
                    console.log('❌ FAIL');
                    console.log(`     Expected: ${testCase.expected} (Violation)`);
                    console.log(`     Actual:   ${hasViolation ? 'Violation Found' : 'No Violation'}`);
                    if (violation) {
                        console.log(`     Details:  ${violation.description}`);
                    }
                }

            } catch (error) {
                console.log('🚨 ERROR');
                console.error(error);
            }
        }
        console.log('\n');
    }

    console.log(`🏁 Summary: ${passedTests}/${totalTests} tests passed.`);
    
    if (passedTests === totalTests) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runActTests().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
