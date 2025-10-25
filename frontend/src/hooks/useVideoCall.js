import { useState, useRef, useEffect } from 'react';

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

  // WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Start call timer
  const startCallTimer = () => {
    setCallDuration(0);
    callStartTimeRef.current = Date.now();
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Stop call timer
  const stopCallTimer = () => {
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
      }
    }
  };

  // Initialize peer connection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(rtcConfig);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('video-call.ice-candidate', {
          receiverId: otherUserId,
          candidate: event.candidate
        });
      }
    };
    
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        startCallTimer();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
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
      
      // Get user media (audio + video)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 640, height: 480 } 
      });
      localStreamRef.current = stream;
      
      // Create peer connection
      const pc = createPeerConnection();
      
      // Add local stream tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Send offer to the other user via socket
      socket.emit('video-call.offer', {
        receiverId: otherUserId,
        offer: offer
      });
      
    } catch (error) {
      console.error('Error starting video call:', error);
      alert('Failed to start video call. Please check camera/microphone permissions.');
      setCallState('idle');
    }
  };

  // Answer incoming video call
  const answerCall = async () => {
    if (!incomingCall || !socket) return;
    
    try {
      setCallState('connected');
      
      // Get user media (audio + video)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 640, height: 480 } 
      });
      localStreamRef.current = stream;
      
      // Create peer connection
      const pc = createPeerConnection();
      
      // Add local stream tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      // Set remote description from the offer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      
      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Send answer back via socket
      socket.emit('video-call.answer', {
        receiverId: incomingCall.callerId,
        answer: answer
      });
      
      setIncomingCall(null);
      
    } catch (error) {
      console.error('Error answering video call:', error);
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
      setIncomingCall(null);
    }
    setCallState('idle');
  };

  // End call
  const endCall = () => {
    const hadActiveCall = callState === 'connected';
    const finalDuration = callDuration;
    
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Stop timer
    stopCallTimer();
    
    // Notify other user
    if (callState !== 'idle' && socket && otherUserId) {
      socket.emit('video-call.end', {
        receiverId: otherUserId
      });
    }
    
    // Create call log if call was connected
    if (hadActiveCall && finalDuration > 0 && onCallEnd) {
      onCallEnd(finalDuration, 'video');
    }
    
    setCallState('idle');
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    callStartTimeRef.current = null;
  };

  // Handle incoming call signals
  useEffect(() => {
    if (!socket) return;
    
    const handleCallOffer = async (data) => {
      setIncomingCall({
        callerId: data.senderId,
        callerName: data.callerName || 'User',
        offer: data.offer
      });
      setCallState('ringing');
    };
    
    const handleCallAnswer = async (data) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };
    
    const handleIceCandidate = async (data) => {
      if (peerConnectionRef.current && data.candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };
    
    const handleCallReject = () => {
      setCallState('idle');
      endCall();
      alert('Video call was rejected');
    };
    
    const handleCallEnd = () => {
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
