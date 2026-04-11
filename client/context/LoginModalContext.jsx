import { createContext, useState, useCallback } from "react";

export const LoginModalContext = createContext();

export const LoginModalProvider = ({ children }) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const openLoginModal = useCallback(() => {
    setShowLoginModal(true);
    setShowRegisterModal(false);
  }, []);

  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  const openRegisterModal = useCallback(() => {
    setShowRegisterModal(true);
    setShowLoginModal(false);
  }, []);

  const closeRegisterModal = useCallback(() => {
    setShowRegisterModal(false);
  }, []);

  const switchToRegister = useCallback(() => {
    setShowLoginModal(false);
    // Small delay to ensure smooth transition between modals
    setTimeout(() => {
      setShowRegisterModal(true);
    }, 300);
  }, []);

  const switchToLogin = useCallback(() => {
    setShowRegisterModal(false);
    // Small delay to ensure smooth transition between modals
    setTimeout(() => {
      setShowLoginModal(true);
    }, 300);
  }, []);

  return (
    <LoginModalContext.Provider
      value={{
        showLoginModal,
        setShowLoginModal,
        openLoginModal,
        closeLoginModal,
        showRegisterModal,
        setShowRegisterModal,
        openRegisterModal,
        closeRegisterModal,
        switchToRegister,
        switchToLogin,
      }}
    >
      {children}
    </LoginModalContext.Provider>
  );
};
