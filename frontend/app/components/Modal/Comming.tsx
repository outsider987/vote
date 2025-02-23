import ConfimModal from "./Confim";

const CommingModal = ({
  show,
  setShow,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
}) => {
  return (
    <ConfimModal
      show={show}
      title="We're Almost There!"
      onClose={() => setShow(false)}
      buttonText={"Close"}
      size="xl"
    >
      <p className="text-center text-base text-black mb-12">
        Thank you for your interest. Our DApp is still under development and not
        ready yet. Stay tuned for an exciting experience coming soon!
      </p>
    </ConfimModal>
  );
};

export default CommingModal;
