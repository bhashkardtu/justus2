# Video Call Feature Documentation

## Overview
The video call feature has been successfully integrated into the JustUs chat application, working alongside the existing voice call functionality. Both features use WebRTC for peer-to-peer audio/video communication and Socket.IO for signaling.

## Implementation Details

### Frontend Components

#### 1. **useVideoCall Hook** (`frontend/src/hooks/useVideoCall.js`)
Custom React hook that manages the complete video call lifecycle:
- **WebRTC Setup**: Creates peer connection with audio and video streams
- **Media Constraints**: `{ audio: true, video: { width: 640, height: 480 } }`
- **Call States**: `idle`, `calling`, `ringing`, `connected`
- **Controls**: 
  - `toggleMute()`: Mute/unmute microphone
  - `toggleVideo()`: Turn camera on/off
- **Events Emitted**:
  - `video-call.offer`: Initiate video call
  - `video-call.answer`: Accept incoming call
  - `video-call.ice-candidate`: Exchange ICE candidates
  - `video-call.reject`: Reject incoming call
  - `video-call.end`: End active call

#### 2. **VideoCallModal Component** (`frontend/src/components/VideoCallModal.js`)
Full-screen video call interface:
- **Layout**:
  - Remote video: Main view (full screen, contain aspect ratio)
  - Local video: Picture-in-Picture (top-right corner, 200x150px, mirrored)
- **Controls**:
  - Mute button (microphone icon)
  - Video toggle button (camera icon)
  - End call button (red phone icon)
- **Incoming Call UI**: Answer/Reject buttons with caller information
- **Call Timer**: Displays call duration during active calls

#### 3. **ChatHeader Component** (`frontend/src/components/ChatHeader.js`)
Updated to include both call buttons:
- **Voice Call Button**: Phone icon (existing)
- **Video Call Button**: Video camera icon (new)
- **Visibility**: Both buttons only show when no call is active (`voiceCallState === 'idle' && videoCallState === 'idle'`)
- **Enabled State**: Only active when user is online (`connectionStatus === 'connected'`)

#### 4. **ChatPage Integration** (`frontend/src/pages/ChatPage.js`)
Orchestrates both voice and video calls separately:
- **Separate State**: Voice and video calls maintain independent state to avoid conflicts
- **Call Handlers**:
  - `handleCallEnd(duration, callType)`: Creates call log messages
  - Differentiates between 'voice' and 'video' calls
- **Call Logs**: Displays "Voice call • 2m 15s" or "Video call • 2m 15s"

### Backend Components

#### 1. **WebSocket Handlers** (`backend/src/websocket/socketHandler.js`)
Added video call signaling handlers:
- `video-call.offer`: Forward call offer to receiver
- `video-call.answer`: Forward answer to caller
- `video-call.ice-candidate`: Exchange ICE candidates between peers
- `video-call.reject`: Notify caller of rejection
- `video-call.end`: Notify both parties when call ends

#### 2. **Message Model** (`backend/src/models/Message.js`)
Supports call log messages:
- **Type**: `'call'` for both voice and video calls
- **Metadata**: Stores `{ callType: 'voice' | 'video', duration: number }`

## User Flow

### Outgoing Video Call
1. User clicks video camera icon in ChatHeader
2. `startVideoCall()` is called
3. Browser requests camera/microphone permissions
4. Local video stream starts
5. Call state changes to `calling`
6. WebRTC offer is created and sent via `video-call.offer` event
7. Receiver's modal shows incoming call UI

### Incoming Video Call
1. Receiver gets `video-call.offer` event
2. VideoCallModal displays with caller name
3. Call state changes to `ringing`
4. User can Answer or Reject:
   - **Answer**: Local stream starts, WebRTC answer sent
   - **Reject**: `video-call.reject` event sent, modal closes

### Active Video Call
1. After answer, ICE candidates are exchanged
2. Peer connection established
3. Remote video stream appears in main view
4. Local video shows in PiP corner
5. User can:
   - **Mute/Unmute**: Toggle microphone
   - **Video On/Off**: Toggle camera
   - **End Call**: Terminate connection

### Call End
1. Either party clicks end call button
2. `video-call.end` event sent
3. Peer connection closed
4. Media streams stopped
5. Call log message created and saved
6. Modal closes, state returns to `idle`

## Key Features

### WebRTC Configuration
- **STUN Servers**: Google STUN servers for NAT traversal
- **Media Constraints**: 640x480 video resolution, audio enabled
- **ICE Candidates**: Automatic exchange for connection establishment

### UI/UX Features
- **Responsive Design**: Full-screen modal for immersive experience
- **PiP Local View**: Mirrored local video in corner (natural mirror effect)
- **Control Icons**: Clear visual indicators for mute/video/end actions
- **Call Timer**: Real-time duration display
- **Disabled States**: Buttons properly disabled when offline

### Separate Voice/Video Systems
- **Independent State**: Voice and video calls don't interfere
- **Distinct Events**: Different Socket.IO event namespaces
- **Call Type Tracking**: Logs clearly labeled as voice or video
- **Parallel Hooks**: `useVoiceCall` and `useVideoCall` work side-by-side

## Testing Checklist

- [ ] Camera/microphone permissions prompt correctly
- [ ] Local video stream displays in PiP (mirrored)
- [ ] Remote video stream displays in main view
- [ ] Mute button toggles microphone on/off
- [ ] Video button toggles camera on/off
- [ ] Call timer shows accurate duration
- [ ] Answer/reject buttons work on incoming calls
- [ ] End call button terminates connection
- [ ] Call logs appear with "Video call" label
- [ ] Call logs show correct duration
- [ ] Video and voice calls don't conflict
- [ ] Both call buttons hidden during active call

## Browser Compatibility
- Requires modern browser with WebRTC support
- getUserMedia API for camera/microphone access
- RTCPeerConnection for peer-to-peer video
- Tested on Chrome, Edge, Firefox (recommended)

## Security Considerations
- WebRTC uses peer-to-peer encryption (DTLS-SRTP)
- Media streams never pass through server
- Socket.IO used only for signaling
- JWT authentication required for WebSocket connection

## Future Enhancements
- Screen sharing capability
- Group video calls (multi-party)
- Recording functionality
- Virtual backgrounds
- Bandwidth optimization
- Network quality indicators
- Reconnection handling for poor connections
