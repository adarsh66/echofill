'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { PhoneOutgoing, Mic, MicOff, X, Eraser } from 'lucide-react'
import { Recorder } from "@/components/recorder"
import { Player } from "@/components/player"
import { AudioWave } from "@/components/ui/audio-wave"
import ReactMarkdown from 'react-markdown'


const sendEmail = async (email: string) => {
  console.log('Sending email to:', email)
  return { success: true }
}

// let sessionInstructions = `You are a customer service agent for SATS, assisting consignees in filling out the necessary forms to collect their delivery.
// Provide a guidance to help the consignee understand the procedure for collecting their delivery. Extract the following details during the conversation:
// ## Pause as and when it is required to allow the consignee to provide the necessary information. You can be friendly with your tone. 
// ## Make sure to Summarise the user information before you end the call - do this action alone slowly and precisely.
//   Name:
//   Shipment Tracking No: 
//   Collection Date:
//   Identification Details: <usually passport or NRIC>
//   Special Instructions:
// ## Make sure to inform the user that you will generate the form and send it to their email address. They should check their email for the form and sign it when they come for collection.
// `;

console.log('All environment variables:', process.env);

const WebSocketURL = process.env.NEXT_PUBLIC_GPT4Q_REALTIME_WEBSOCKET_URL;
const backendAOAIURL = process.env.NEXT_PUBLIC_APP_AOAI_URL;
const backendMailURL = process.env.NEXT_PUBLIC_APP_MAIL_URL;
console.log('WebSocketURL:', WebSocketURL);
console.log('backendAOAIURL:', backendAOAIURL);
console.log('backendMailURL:', backendMailURL);

export default function InteractiveBusinessPage() {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isPhoneCallActive, setisPhoneCallActive] = useState(false);
  // const [isChatOpen, setIsChatOpen] = useState(false)
  const [messageHistory, setMessageHistory] = useState<{ role: string; content: string }[]>([])

  const [chatWidth, setChatWidth] = useState(384) // Default width: 96 * 4 = 384px
  const [isDragging, setIsDragging] = useState(false)
  const [messages, setMessages] = useState<{ text: string; isBot: boolean }[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false)
  const [isEmailRequested, setIsEmailRequested] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<Recorder | null>(null)
  const playerRef = useRef<Player | null>(null)
  
  const [sessionInstructions, setSessionInstructions] = useState('');
  



  useEffect(() => {
  // Fetch session instructions from a flat file
  fetch('gpt-4o_session_instructions.txt')
    .then(response => response.text())
    .then(data => setSessionInstructions(data));
  }, []);

  const audioBufferRef = useRef<Buffer[]>([])
  const [isAudioPaused, setIsAudioPaused] = useState(false) // to pause audio call

  const customerCall = true; // This should be your actual constant variable

  useEffect(() => {
    if (customerCall) {
      setisPhoneCallActive(true);
    } else {
      setisPhoneCallActive(false);
    }
  }, [customerCall]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  // useEffect(() => {
  //   return () => {
  //     if (websocketRef.current) {
  //       websocketRef.current.close()
  //     }
  //     if (recorderRef.current) {
  //       recorderRef.current.stop()
  //     }
  //   }
  // }, [])


  const sendMessageHistoryToBackend = async () => {
    try {
      const response = await fetch(backendMailURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageHistory }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message history to backend')
      }

      const data = await response.json()
      console.log('Message history sent successfully:', data)
      return { success: true }
    } catch (error) {
      console.error('Error sending message history to backend:', error)
      setError('Failed to send message history. Please try again.')
    }
  }


      // Placeholder functions for backend connections
  const sendChatMessage = async (message: string) => {
    console.log('Sending chat message:', message)
    // return { text: `Response to: ${message}` }
    try {
      const updatedHistory = [...messageHistory,{ role: 'user', content: message }
      ]
      setMessageHistory(updatedHistory);
      console.log('Updated message history:', updatedHistory);
      // const msg = { messages: updatedHistory }
      // console.log('msg:', msg);
      
      const response = await fetch(backendAOAIURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ messages: updatedHistory }),
      });
      const data = await response.json();//await response.json();
      console.log('Response:', data);
      setMessageHistory(prev => [...prev, { role: 'assistant', content: data.text }]);
      return data;
    } catch (error) {
      console.error('Error sending chat message:', error);
      return { text: 'Sorry, there was an error processing your request.' };
    }
  }
  
  const handleSendMessage = async () => {
    if (inputMessage.trim()) {
      setMessages(prev => [...prev, { text: inputMessage, isBot: false }])
      setInputMessage('')
      const response = await sendChatMessage(inputMessage)
      setMessages(prev => [...prev, { text: response.text, isBot: true }])
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const newWidth = window.innerWidth - e.clientX
      setChatWidth(Math.max(300, Math.min(newWidth, window.innerWidth * 0.8)))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove as any)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove as any)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])



  const requestMicrophoneAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop()) // Stop the stream immediately
      return true
    } catch (error) {
      console.error('Error requesting microphone access:', error)
      setError('Microphone access was denied. Please allow microphone access and try again.')
      return false
    }
  }

  const startVoiceCall = async () => {
    setError(null)
    const hasMicrophoneAccess = await requestMicrophoneAccess()
    if (!hasMicrophoneAccess) {
      return
    }

    try {
      websocketRef.current = new WebSocket(WebSocketURL)
      websocketRef.current.onopen = () => {
        console.log('Connected to AOAI WebSocket relay')
        setIsVoiceCallActive(true)
        
        // Send initial session update message
        const message = JSON.stringify({
          type: 'session.update',
          session: {
            voice: 'alloy',
            instructions: sessionInstructions,
            input_audio_format: 'pcm16',
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.4,
              silence_duration_ms: 800,
            },
          },
        })
        websocketRef.current?.send(message)
        console.log('Sent to AOAI WebSocket:', message)
      }

      websocketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data)
        // console.log('Received from AOAI WebSocket:', data)
        
        switch (data.type) {
          case 'response.audio_transcript.delta':
            setMessages(prev => {
              const lastMessage = prev[prev.length - 1]
              if (lastMessage && lastMessage.isBot) {
                return [...prev.slice(0, -1), { ...lastMessage, text: lastMessage.text + data.delta }]
              } else {
                return [...prev, { text: data.delta, isBot: true }]
              }
            })
            break
          case 'response.audio.delta':
            if (playerRef.current) {
              const binary = atob(data.delta)
              const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
              const pcmData = new Int16Array(bytes.buffer)
              playerRef.current.play(pcmData)
            }
            break
          case 'conversation.item.input_audio_transcription.completed':
            setMessages(prev => [...prev, { text: `${data.transcript}`, isBot: false }])
            // voiceTranscription = data.transcript;
            messageHistory.push({ "role": 'user', "content": data.transcript });
            console.log("voiceTranscription- Custom:", messageHistory);
            break
          case 'response.audio_transcript.done':
            messageHistory.push({ "role": 'assistant', "content": data.transcript });
            console.log("voiceTranscription- Custom:", messageHistory);
            break

        }
      }

      websocketRef.current.onclose = () => {
        console.log('Disconnected from Python WebSocket relay')
        setIsVoiceCallActive(false)
      }

      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setError('Failed to connect to the server. Please try again.')
        setIsVoiceCallActive(false)
      }

      // Initialize audio recorder and player
      recorderRef.current = new Recorder((buffer: Buffer) => {
        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN && !isAudioPaused ) {
          const uint8Array = new Uint8Array(buffer)
          const base64 = btoa(String.fromCharCode.apply(null, uint8Array as any))
          websocketRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64,
          }))
        }  else if (isAudioPaused) {
          // Store the buffer when paused
          audioBufferRef.current.push(buffer)
        }
      })

      playerRef.current = new Player()
      await playerRef.current.init(24000)

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      await recorderRef.current.start(stream)

    } catch (error) {
      console.error('Error starting voice call:', error)
      setIsVoiceCallActive(false)
      setError('An error occurred while starting the voice call. Please try again.')
    }
  }

  const stopVoiceCall = () => {
    if (websocketRef.current) {
      websocketRef.current.close()
    }
    if (recorderRef.current) {
      recorderRef.current.stop()
    }
    if (playerRef.current) {
      playerRef.current.clear()
    }
    setIsVoiceCallActive(false)
    setMessages(prev => [...prev, { text: "Please Enter your Email Address", isBot: true }]) 
    setIsEmailRequested(true)
  }

  const handleVoiceCall = () => {
    if (isVoiceCallActive) {
      stopVoiceCall()
    } else {
      startVoiceCall()
    }
  }

  const handleEmailSubmit = async () => {
    if (inputMessage.includes('@')) {
      setMessages(prev => [...prev, { text: inputMessage, isBot: false }])
      const updatedHistory = [...messageHistory,{ role: 'user', content: inputMessage}]
      setMessageHistory(updatedHistory);
      setInputMessage('')
      setMessages(prev => [...prev, { text: "Please wait while i m processing your documentation ...", isBot: true }]);
      const result = await sendMessageHistoryToBackend();
      if (result.success) {
        setIsEmailRequested(false)
        setMessages(prev => [...prev, { text: "I have send it to your email", isBot: true }])
      }
    } else {
      setMessages(prev => [...prev, { text: "Please enter a valid email address.", isBot: true }])
    }
  }

  const clearChat = () => {
    console.log('Clearing chat');
    console.log('Messages:', messages);  
    console.log('Message History:', messageHistory);
    setMessages([]);
    setMessageHistory([]);
  };

  const toggleAudioTransmission = () => {
    setIsAudioPaused((prevState) => {
      const newState = !prevState
      if (newState) {
        // Pause audio
        if (recorderRef.current) {
          recorderRef.current.pause()
        }
        if (playerRef.current) {
          playerRef.current.pause()
        }
        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
          websocketRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.clear',
          }))
        }
      } else {
        // Resume audio
        if (recorderRef.current) {
          recorderRef.current.resume()
        }
        if (playerRef.current) {
          playerRef.current.resume()
        }
        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
          // Send stored buffer data
          audioBufferRef.current.forEach(buffer => {
            const uint8Array = new Uint8Array(buffer)
            const base64 = btoa(String.fromCharCode.apply(null, uint8Array as any))
            websocketRef.current?.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64,
            }))
          })
          // Clear the stored buffer
          audioBufferRef.current = []
          // Commit the buffer
          websocketRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.commit',
          }))
        }
      }
      return newState
    })
  }


  useEffect(() => {
    // ... (existing useEffect logic)

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close()
      }
      if (recorderRef.current) {
        recorderRef.current.stop()
      }
      if (playerRef.current) {
        playerRef.current.stop()
      }
      // Clear the audio buffer
      audioBufferRef.current = []
    }
  }, [])

  return (
    <div className="flex h-screen bg-gray-100" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} >
      <div className="flex-1 p-1 overflow-y-auto">
        <div className="mb-1">
          {/* <img src="/placeholder.svg?height=200&width=800" alt="Business Banner" className="w-full h-50 object-cover rounded-lg shadow-md" /> */}
          <img 
            src="/Banner-Image.jpg" 
            alt="Business Banner" 
            className="w-full h-full object-contain rounded-lg shadow-md" 
          />
        </div>

        {/* <div className="prose max-w-none">
          <div>
              <h2 className="text-4xl font-bold mb-4" style={{ color: '#8A0000' }}>Seamless Connections</h2>
              <p className="text-lg mb-6">Every day at Changi Airport, one of the world’s busiest and best cargo hubs, SATS is there.</p>
              <p className="text-lg mb-6">Seamlessly connecting millions of tonnes of cargo from Singapore to the world.</p>
              <p className="text-lg mb-6">Our experienced and highly trained teams use cutting-edge technology and leading automation systems, powered by six airfreight terminals including an Express Courier Centre.</p>
            </div>

        <div >
        <h2 className="text-2xl font-semibold mb-4">Our Services</h2>
            <h3 className="text-xl font-semibold mb-3">WFS (Worldwide Flight Services)</h3>
            <p className="text-lg mb-6">WFS is now a member of the SATS Group. WFS works closely with airlines, airports, freight forwarders and businesses, and our experienced, passionate and proactive team constantly seek the safest, most efficient way to deliver best-in-class solutions.</p>
        </div>
      </div>

        <div className="prose max-w-none">
          <ul className="list-disc pl-5 mb-6">
            <li>Warehouse</li>
            <li>Consignments</li>
          </ul>
        </div>*/}
      </div> 
      
      <div 
        className={`relative transition-all duration-300 ease-in-out ${isChatOpen ? '' : 'w-12'}`}
        style={{ width: isChatOpen ? `${chatWidth}px` : '48px' }}
      >

                {isChatOpen ? (
          <X  
            className="w-8 h-8 text-red-800 absolute bottom-100 left-5 z-10 shadow-md" 
            onClick={() => setIsChatOpen(!isChatOpen)} 
          />
        ) : (
          <img 
            src="/Cartoon_avatar_logo.png" 
            alt="CargoMate Logo" 
            className="w-16 h-16 object-contain my-1 absolute bottom-10 -left-10 z-10 shadow-md" 
            onClick={() => setIsChatOpen(!isChatOpen)} 
          />
        )}
        
        {isChatOpen && (
          <Card className="h-full flex flex-col bg-white shadow-xl">
              <div 
              className="w-1 absolute left-0 top-0 bottom-0 cursor-ew-resize bg-gray-300 hover:bg-gray-400"
              onMouseDown={handleMouseDown}
            />

              {/* Chat Header with Logo */}
              <div className="p-2 border-b flex items-center gap-2">
              <Eraser className="ml-auto w-4 h-4 cursor-pointer" onClick={clearChat}/>
            </div>

            <div className="flex-1 overflow-y-auto p-5" ref={chatContainerRef}>
              <div className="flex flex-col w-3/5 mx-auto items-center mb-8 border border-red-800 shadow-lg p-4 rounded-lg" style={{ boxShadow: '0 3px 5px rgba(139, 0, 0, 0.5)' }}>
                <img 
                  src="/Cartoon_avatar_logo.png" 
                  alt="CargoMate Logo" 
                  className="w-16 h-16 object-contain my-1"
                />
                <h2 className="font-bold text-lg mb-2">CargoMate</h2>
                <p className="text-sm text-muted-foreground text-center">
                  By engaging in chat, you consent to possible conversation recording.
                </p>
              </div>
              {messages.map((msg, index) => (
                <div key={index} className={`mb-4 ${msg.isBot ? 'w-5/6 mr-auto text-left' : 'w-1/2 ml-auto text-right'}`}>
                  {/* <span className={`inline-block p-2 rounded-lg ${msg.isBot ? 'bg-gray-200' : 'bg-blue-200'}`}> */}
                  {msg.isBot && (
                    <img 
                      src="/Cartoon_avatar_logo.png" 
                      alt="CargoMate" 
                      className="w-6 h-6 object-contain mr-2 self-end"
                    />
                  )}
                  <div 
                    className={`max-w-[100%] p-3 rounded-lg ${
                      msg.isBot 
                        ? 'bg-gray-100' 
                        : 'bg-[#8A0000] text-white'
                    }`}
                  >
                  {msg.isBot ? (
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    ) : (
                      msg.text
                    )}
                  {/* </span> */}
                  </div>
                </div>
              ))}
            </div>
            
            {isVoiceCallActive ? (
              <div className="p-2 bg-gray-100 text-center flex flex-col items-center h-80">
                <div className="flex flex-col items-center space-y-4">
                {!isAudioPaused ? (
                <>
                  <AudioWave />
                  <button
                    onClick={toggleAudioTransmission}
                    className="p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-blue-500 text-white focus:ring-blue-500"
                    aria-label="Pause Audio"
                  >
                    <Mic className="h-6 w-6" />
                  </button>
                  <p className="my-6 text-lg">
                    You are now speaking to <strong>CargoMate</strong>
                  </p>
                  <p className="text-sm text-gray-600">Audio active</p>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleAudioTransmission}
                    className="p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-red-500 text-white focus:ring-red-500"
                    aria-label="Resume Audio"
                  >
                    <MicOff className="h-6 w-6" />
                  </button>
                  <p className="my-6 text-lg">Call on hold</p>
                  <p className="text-sm text-gray-600">Audio paused</p>
                </>
              )}
                <Button 
                  onClick={handleVoiceCall} 
                  className="mt-4"
                  style={{ backgroundColor: '#8A0000', color: 'white' }}
                >
                  End Call
                </Button>
              </div>
              </div>
            ) : (
              <div className="p-4 flex items-center">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 mr-2"
                  onKeyPress={(e) => e.key === 'Enter' && (isEmailRequested ? handleEmailSubmit() : handleSendMessage())}
                />
                <Button onClick={isEmailRequested ? handleEmailSubmit : handleSendMessage} 
                className="mr-2" style={{ backgroundColor: '#8A0000', color: 'white' }} >
                  Send
                </Button>
                <Button variant="outline" size="icon" onClick={handleVoiceCall}>
                  <PhoneOutgoing fill="green" className={`h-4 w-4 ${isPhoneCallActive ? 'text-green-700' : ''}`} />
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}