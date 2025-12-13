import { useState, useRef, useEffect } from 'react';
import { getWebRTCConfig } from '../services/config';

export default function useVideoCall({ socket, userId, otherUserId, otherUser, onCallEnd }) {
  const [callState, setCallState] = useState('idle'); // idle, calling, ringing, connected, ended
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callTimerRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const rtcConfigRef = useRef(null);

  // Fetch WebRTC config from backend on mount
  useEffect(() => {
    const fetchConfig = async () => {
      const config = await getWebRTCConfig();
      rtcConfigRef.current = config;
      console.log('[video] WebRTC config loaded from backend');
    };
    fetchConfig();
  }, []);

  // Start call timer
  const startCallTimer = () => {
    console.log('[video] startCallTimer');
    setCallDuration(0);
    callStartTimeRef.current = Date.now();
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => {
        const next = prev + 1;
        // debug log each 5 seconds to avoid spam
        if (next % 5 === 0) console.log('[video] callDuration', next);
        return next;
      });
    }, 1000);
  };

  // Stop call timer
  const stopCallTimer = () => {
    console.log('[video] stopCallTimer');
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // Toggle microphone
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log('[video] toggleMute, nowMuted=', !audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        console.log('[video] toggleVideo, nowVideoOff=', !videoTrack.enabled);
      }
    }
  };

  // Initialize peer connection
  const createPeerConnection = () => {
    const config = rtcConfigRef.current;
    if (!config) {
      console.error('[video] WebRTC config not loaded yet');
      return null;
    }
    
    console.log('[video] createPeerConnection with config from backend');
    const pc = new RTCPeerConnection(config);
    
    pc.onicecandidate = (event) => {
      console.log('[video] onicecandidate event:', event);
      if (event.candidate) {
        console.log('[video] local ICE candidate:', event.candidate.candidate);
        if (event.candidate.candidate && event.candidate.candidate.includes(' typ relay')) {
          console.log('[video] RELAY candidate generated locally');
        }
      }
      if (event.candidate && socket) {
        socket.emit('video-call.ice-candidate', {
          receiverId: otherUserId,
          candidate: event.candidate
        });
        console.log('[video] sent video-call.ice-candidate to socket', otherUserId);
      }
    };

    pc.onicecandidateerror = (err) => {
      console.error('[video] onicecandidateerror', err);
    };
    
    pc.ontrack = (event) => {
      console.log('[video] Received remote track event, tracks:', event.streams ? event.streams[0]?.getTracks().map(t=>t.kind) : 'no streams');
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        console.log('[video] remoteStreamRef set, tracks:', remoteStreamRef.current.getTracks().map(t=>t.kind));
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log('[video] connection state changed ->', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        console.log('[video] Peer connection is connected');
        startCallTimer();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.warn('[video] Peer connection disconnected/failed:', pc.connectionState);
        endCall();
      } else {
        console.log('[video] connectionState:', pc.connectionState);
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('[video] iceGatheringState:', pc.iceGatheringState);
    };

    pc.onsignalingstatechange = () => {
      console.log('[video] signalingState:', pc.signalingState);
    };
    
    peerConnectionRef.current = pc;
    return pc;
  };

  // Start a video call
  const startCall = async () => {
    if (!socket || !otherUserId) {
      alert('Cannot start call: not connected');
      return;
    }

    try {
      setCallState('calling');
      console.log('[video] startCall -> requesting camera/mic');
      
      // Get user media (audio + video)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 640, height: 480 } 
      });
      console.log('[video] getUserMedia success, tracks:', stream.getTracks().map(t => t.kind));
      localStreamRef.current = stream;
      
      // Create peer connection
      const pc = createPeerConnection();
      
      // Add local stream tracks to peer connection
      stream.getTracks().forEach(track => {
        const sender = pc.addTrack(track, stream);
        console.log('[video] added local track', track.kind, 'sender=', sender);
      });
      
      // Create offer
      const offer = await pc.createOffer();
      console.log('[video] created offer', offer.sdp?.slice(0,200));
      await pc.setLocalDescription(offer);
      console.log('[video] setLocalDescription done');
      
      // Send offer to the other user via socket
      socket.emit('video-call.offer', {
        receiverId: otherUserId,
        offer: offer
      });
      console.log('[video] emitted video-call.offer to', otherUserId);
      
    } catch (error) {
      console.error('[video] Error starting video call:', error);
      alert('Failed to start video call. Please check camera/microphone permissions.');
      setCallState('idle');
    }
  };

  // Answer incoming video call
  const answerCall = async () => {
    if (!incomingCall || !socket) return;
    
    try {
      console.log('[video] Answering call from', incomingCall.callerId);
      setCallState('connected');
      
      // Get user media (audio + video)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 640, height: 480 } 
      });
      console.log('[video] getUserMedia for answer success, tracks:', stream.getTracks().map(t=>t.kind));
      localStreamRef.current = stream;
      
      // Create peer connection
      const pc = createPeerConnection();
      
      // Add local stream tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        console.log('[video] added local track for answer', track.kind);
      });
      
      // Set remote description from the offer
      console.log('[video] setting remote description from offer');
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      
      // Flush queued ICE candidates after peer connection is ready
      if (pendingCandidates.current.length > 0) {
        console.log(`[voice] Adding ${pendingCandidates.current.length} queued ICE candidates`);
        for (const candidate of pendingCandidates.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidates.current = [];
      }


      // Create answer
      const answer = await pc.createAnswer();
      console.log('[video] created answer', answer.sdp?.slice(0,200));
      await pc.setLocalDescription(answer);
      console.log('[video] setLocalDescription(answer) done');
      
      // Send answer back via socket
      socket.emit('video-call.answer', {
        receiverId: incomingCall.callerId,
        answer: answer
      });
      console.log('[video] emitted video-call.answer to', incomingCall.callerId);
      
      setIncomingCall(null);
      
    } catch (error) {
      console.error('[video] Error answering video call:', error);
      alert('Failed to answer video call. Please check camera/microphone permissions.');
      rejectCall();
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    if (incomingCall && socket) {
      socket.emit('video-call.reject', {
        receiverId: incomingCall.callerId
      });
      console.log('[video] emitted reject to', incomingCall.callerId);
      setIncomingCall(null);
    }
    setCallState('idle');
  };

  // End call
  const endCall = () => {
    console.log('[video] endCall called, callState=', callState);
    const hadActiveCall = callState === 'connected';
    const finalDuration = callDuration;
    
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[video] stopped local track', track.kind);
      });
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
        console.log('[video] peerConnection closed');
      } catch (e) {
        console.error('[video] error closing peerConnection', e);
      }
      peerConnectionRef.current = null;
    }
    
    // Stop timer
    stopCallTimer();
    
    // Notify other user
    if (callState !== 'idle' && socket && otherUserId) {
      socket.emit('video-call.end', {
        receiverId: otherUserId
      });
      console.log('[video] emitted end to', otherUserId);
    }
    
    // Create call log if call was connected
    if (hadActiveCall && finalDuration > 0 && onCallEnd) {
      onCallEnd(finalDuration, 'video');
      console.log('[video] onCallEnd fired', finalDuration);
    }
    
    setCallState('idle');
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    callStartTimeRef.current = null;
  };

  // Handle incoming call signals
  const pendingCandidates = useRef([]);

  useEffect(() => {
    if (!socket) return;
    
    const handleCallOffer = async (data) => {
      console.log('[video] received video-call.offer from', data.senderId);
      setIncomingCall({
        callerId: data.senderId,
        callerName: data.callerName || 'User',
        offer: data.offer
      });
      setCallState('ringing');
    };
    
    const handleCallAnswer = async (data) => {
      console.log('[video] received video-call.answer from', data.senderId);
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log('[video] setRemoteDescription(answer) success');
        } else {
          console.warn('[video] no peerConnection to set remote answer on');
        }
      } catch (err) {
        console.error('[video] error setting remote answer', err);
      }
    };
    
    const handleIceCandidate = async (data) => {
  console.log('[video] received remote ICE candidate from socket', data);
  try {
    if (peerConnectionRef.current && data.candidate) {
      if (data.candidate.candidate && data.candidate.candidate.includes(' typ relay')) {
        console.log('[video] REMOTE relay candidate received');
      }
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      console.log('[video] addIceCandidate success');
    } else {
      // No peer connection yet — queue it for later
      console.warn('[video] No peerConnection yet, queueing candidate');
      pendingCandidates.current.push(data.candidate);
    }
  } catch (err) {
    console.error('[video] addIceCandidate error', err);
  }
};

    
    const handleCallReject = () => {
      console.log('[video] received video-call.reject');
      setCallState('idle');
      endCall();
      alert('Video call was rejected');
    };
    
    const handleCallEnd = () => {
      console.log('[video] received video-call.end');
      endCall();
    };
    
    socket.on('video-call.offer', handleCallOffer);
    socket.on('video-call.answer', handleCallAnswer);
    socket.on('video-call.ice-candidate', handleIceCandidate);
    socket.on('video-call.reject', handleCallReject);
    socket.on('video-call.end', handleCallEnd);
    
    return () => {
      socket.off('video-call.offer', handleCallOffer);
      socket.off('video-call.answer', handleCallAnswer);
      socket.off('video-call.ice-candidate', handleIceCandidate);
      socket.off('video-call.reject', handleCallReject);
      socket.off('video-call.end', handleCallEnd);
    };
  }, [socket, otherUserId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  return {
    callState,
    incomingCall,
    callDuration,
    isMuted,
    isVideoOff,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    localStreamRef,
    remoteStreamRef
  };
}
